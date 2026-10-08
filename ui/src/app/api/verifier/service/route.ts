import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { Connection, PublicKey } from '@solana/web3.js'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"

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
    const response = await fetch(resourceUrl, {
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
  const crypto = require('crypto')
  const evidenceData = JSON.stringify({
    resource: resourceUrl,
    payment_signature: paymentSig || 'none',
    payment_verified: paymentVerified,
    service_status: serviceStatus,
    service_response_time_ms: serviceResponseTime,
    timestamp: Math.floor(Date.now() / 1000),
  })
  const evidenceHash = crypto.createHash('sha3-256').update(evidenceData).digest('hex')

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
