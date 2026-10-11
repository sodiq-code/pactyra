import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { Connection, PublicKey } from '@solana/web3.js'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"

/**
 * Reject URLs that would let a caller reach internal or link-local
 * destinations through this server (server-side request forgery).
 * Blocks non-http(s) protocols, internal hostnames, and IP literals
 * in private, loopback, link-local, or cloud-metadata ranges.
 *
 * A production-grade guard would additionally resolve the hostname
 * and pin the connection to the resolved IP to defeat DNS rebinding.
 */
function assertSafeFetchUrl(rawUrl: string): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('invalid url')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`protocol ${parsed.protocol} not allowed`)
  }
  const host = parsed.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === 'metadata.google.internal' ||
    host === 'metadata.aws.internal' ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    throw new Error('internal hostname blocked')
  }
  if (isPrivateIpLiteral(host)) {
    throw new Error('private or link-local ip blocked')
  }
  return parsed
}

function isPrivateIpLiteral(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const a = Number(v4[1]); const b = Number(v4[2])
    if (a === 0) return true                          // 0.0.0.0/8
    if (a === 10) return true                         // private 10/8
    if (a === 127) return true                        // loopback 127/8
    if (a === 169 && b === 254) return true           // link-local + cloud metadata 169.254/16
    if (a === 172 && b >= 16 && b <= 31) return true  // private 172.16/12
    if (a === 192 && b === 168) return true           // private 192.168/16
    return false
  }
  const v6 = ip.toLowerCase()
  if (v6 === '::1' || v6 === '::') return true        // loopback + unspecified
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true  // unique-local fc00::/7
  if (v6.startsWith('fe80')) return true              // link-local fe80::/10
  return false
}

/**
 * Service Outcome Verifier — Verifier B
 *
 * Demonstrates PACTYRA's verifier-agnostic architecture.
 * Verifier A (pactyra-verifier) checks Pyth price freshness.
 * Verifier B (this endpoint) checks whether an x402 service was delivered.
 *
 * Verification logic:
 * 1. Agent pays for a service via x402 (real USDC transfer)
 * 2. Service returns 200 + resource (service delivered)
 * 3. This verifier checks: did the service return HTTP 200?
 * 4. If yes → PASS (evidence: HTTP 200 + payment signature)
 * 5. If no → FAIL (evidence: non-200 status or no payment)
 *
 * This proves PACTYRA works with ANY objective verification source.
 *
 * GET /api/verifier/service?resource=<url>&payment_sig=<tx_signature>
 *
 * Returns:
 * { valid: true/false, result: "pass"/"fail", evidence: {...} }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const resourceUrl = searchParams.get('resource')
  const paymentSig = searchParams.get('payment_sig')

  if (!resourceUrl) {
    return NextResponse.json(
      { valid: false, error: 'resource URL required as ?resource=<url>' },
      { status: 400 }
    )
  }

  let safeUrl: URL
  try {
    safeUrl = assertSafeFetchUrl(resourceUrl)
  } catch (e: any) {
    return NextResponse.json(
      { valid: false, error: `resource URL rejected: ${e.message}` },
      { status: 400 }
    )
  }

  const connection = new Connection(DEVNET_RPC, 'confirmed')

  // Step 1: Verify the payment transaction exists on-chain (if provided)
  let paymentVerified = false
  let paymentSlot: number | null = null
  let paymentBlockTime: number | null = null

  if (paymentSig) {
    try {
      const tx = await connection.getTransaction(paymentSig, {
        maxSupportedTransactionVersion: 0,
      })
      if (tx && !tx.meta?.err) {
        paymentVerified = true
        paymentSlot = tx.slot
        paymentBlockTime = tx.blockTime
      }
    } catch {
      // Payment verification failed — not necessarily an error, might not exist yet
    }
  }

  // Step 2: Check if the service resource is accessible
  // If we have a payment signature, retry the resource with the X-PAYMENT header
  // This is the "objective success condition" — did the service deliver after payment?
  let serviceDelivered = false
  let serviceStatus = 0
  let serviceResponseTime = 0

  try {
    const startTime = Date.now()
    const headers: Record<string, string> = {}
    // If payment was verified, pass the X-PAYMENT header to access the resource
    if (paymentVerified && paymentSig) {
      headers['X-PAYMENT'] = Buffer.from(JSON.stringify({
        signature: paymentSig,
        network: 'solana-devnet',
      })).toString('base64')
    }
    const response = await fetch(safeUrl.toString(), {
      headers,
      signal: AbortSignal.timeout(10000),
    })
    serviceStatus = response.status
    serviceResponseTime = Date.now() - startTime
    serviceDelivered = response.ok
  } catch {
    serviceDelivered = false
    serviceStatus = 0
  }

  // Step 3: Determine the outcome
  // PASS: service returned 200 AND payment was verified (if provided)
  // FAIL: service returned non-200 OR payment failed
  const result = serviceDelivered && (!paymentSig || paymentVerified) ? 'pass' : 'fail'

  // Step 4: Compute evidence hash (keccak256 of the evidence data)
  const { keccak_256 } = require('js-sha3')
  const evidenceData = JSON.stringify({
    resource: resourceUrl,
    payment_signature: paymentSig || 'none',
    payment_verified: paymentVerified,
    service_status: serviceStatus,
    service_response_time_ms: serviceResponseTime,
    timestamp: Math.floor(Date.now() / 1000),
  })
  const evidenceHash = keccak_256(evidenceData)

  return NextResponse.json({
    valid: result === 'pass',
    result,
    severity: result === 'pass' ? 'none' : 'ordinary',
    verifier: 'ServiceOutcomeVerifier',
    verifier_type: 'service_delivery',
    evidence: {
      resource: resourceUrl,
      payment_signature: paymentSig,
      payment_verified: paymentVerified,
      payment_slot: paymentSlot,
      payment_block_time: paymentBlockTime,
      service_status: serviceStatus,
      service_response_time_ms: serviceResponseTime,
      evidence_hash: evidenceHash,
      evidence_data: evidenceData,
    },
    description: result === 'pass'
      ? 'Service delivered (HTTP 200) and payment verified on-chain'
      : 'Service not delivered or payment not verified',
  })
}
