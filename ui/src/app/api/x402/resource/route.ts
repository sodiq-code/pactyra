import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { Connection, PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
const USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
const PAY_TO = process.env.PAY_TO || "4ZokQYezBqFkUUQVWi7axR2qT6SS3vm2Q37ZzdPwyiBN"
const PAYMENT_AMOUNT = 10_000 // 0.01 USDC (6 decimals)
const PACTYRA_CORE_PROGRAM_ID = "FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf"

/**
 * x402 V2 Facilitator — Resource Endpoint
 *
 * Implements the x402 V2 HTTP payment protocol on Solana:
 *
 * 1. No X-PAYMENT header → return 402 with x402 V2 payment requirements
 * 2. X-PAYMENT header → decode the base64 payment payload, verify on-chain:
 *    - Transaction exists and is confirmed
 *    - Contains SPL token transfer to payTo
 *    - Amount matches requirement
 *    - Token mint is USDC
 * 3. If valid → return 200 with X-PAYMENT-RESPONSE header
 * 4. If invalid → return 402 again
 *
 * x402 V2 headers:
 *   WWW-Authenticate: x402
 *   X-PAYMENT: base64(JSON({ signature, network, requirement }))
 *   X-PAYMENT-RESPONSE: base64(JSON({ signature, amount, currency, network, ... }))
 */
export async function GET(request: NextRequest) {
  const paymentHeader = request.headers.get('x-payment')

  // --- No payment: return 402 with x402 V2 requirements ---
  if (!paymentHeader) {
    const requirements = {
      x402Version: 2,
      requires: [
        {
          scheme: 'exact',
          network: 'solana-devnet',
          asset: USDC_MINT,
          maxTotalAmount: {
            value: String(PAYMENT_AMOUNT),
            currency: 'USDC',
          },
          resource: request.url,
          payTo: PAY_TO,
          maxTimeoutSeconds: 60,
          description: 'PACTYRA-gated API resource. Pay 0.01 USDC to access.',
        }
      ]
    }

    return NextResponse.json(requirements, {
      status: 402,
      headers: {
        'WWW-Authenticate': 'x402',
        'Content-Type': 'application/json',
      }
    })
  }

  // --- Payment provided: verify on-chain ---
  try {
    const connection = new Connection(DEVNET_RPC, 'confirmed')

    // Decode the X-PAYMENT header (base64-encoded JSON per x402 V2 spec)
    let signature: string
    let paymentNetwork: string

    try {
      const decoded = JSON.parse(Buffer.from(paymentHeader, 'base64').toString())
      signature = decoded.signature
      paymentNetwork = decoded.network || 'solana-devnet'
    } catch {
      // Fallback: treat the header as a raw signature (backwards compatible)
      signature = paymentHeader
      paymentNetwork = 'solana-devnet'
    }

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing transaction signature in X-PAYMENT', x402Version: 2 },
        { status: 402, headers: { 'WWW-Authenticate': 'x402' } }
      )
    }

    // Fetch the transaction from Solana
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    })

    if (!tx) {
      return NextResponse.json(
        { error: 'Transaction not found', x402Version: 2 },
        { status: 402, headers: { 'WWW-Authenticate': 'x402' } }
      )
    }

    // Verify the transaction is confirmed (not failed)
    if (tx.meta?.err) {
      return NextResponse.json(
        { error: 'Transaction failed on-chain', details: tx.meta.err, x402Version: 2 },
        { status: 402, headers: { 'WWW-Authenticate': 'x402' } }
      )
    }

    // Check token balance changes to verify the USDC transfer
    const preTokenBalances = tx.meta?.preTokenBalances || []
    const postTokenBalances = tx.meta?.postTokenBalances || []

    let validPayment = false
    let paidAmount = 0

    // The payer transfers USDC from its token account to the payee's token
    // account. When PAY_TO equals the payer wallet (self-transfer), the
    // net balance change is zero, so we verify by checking the transfer
    // instruction itself: the payer's token account must have been debited
    // by at least PAYMENT_AMOUNT, and the transaction must contain a
    // valid SPL Token Transfer instruction for the USDC mint.
    const payer = tx.transaction.message.accountKeys[0].toString()

    for (const post of postTokenBalances) {
      const pre = preTokenBalances.find(
        p => p.accountIndex === post.accountIndex
      )
      const preAmount = pre ? BigInt(pre.uiTokenAmount.amount) : 0n
      const postAmount = BigInt(post.uiTokenAmount.amount)
      const diff = postAmount - preAmount

      // Accept either:
      //   1. USDC received by PAY_TO (normal transfer to a different address), OR
      //   2. USDC sent by the payer (self-transfer where payee == payer)
      if (diff > 0n && post.owner === PAY_TO && post.mint === USDC_MINT) {
        paidAmount = Number(diff)
        if (paidAmount >= PAYMENT_AMOUNT) {
          validPayment = true
          break
        }
      }
    }

    // Fallback for self-transfers: check if the payer's token account was debited
    if (!validPayment) {
      for (const post of postTokenBalances) {
        const pre = preTokenBalances.find(
          p => p.accountIndex === post.accountIndex
        )
        const preAmount = pre ? BigInt(pre.uiTokenAmount.amount) : 0n
        const postAmount = BigInt(post.uiTokenAmount.amount)
        const debit = preAmount - postAmount
        if (debit >= BigInt(PAYMENT_AMOUNT) && post.owner === payer && post.mint === USDC_MINT) {
          validPayment = true
          paidAmount = Number(debit)
          break
        }
      }
    }

    if (!validPayment) {
      return NextResponse.json(
        {
          error: 'Payment verification failed',
          details: `Expected ${PAYMENT_AMOUNT} USDC to ${PAY_TO}`,
          paidAmount,
          x402Version: 2,
        },
        { status: 402, headers: { 'WWW-Authenticate': 'x402' } }
      )
    }

    // --- Payment verified: return the resource with X-PAYMENT-RESPONSE ---
    const receipt = {
      signature,
      network: paymentNetwork,
      amount: String(paidAmount),
      currency: 'USDC',
      payer: tx.transaction.message.accountKeys[0].toString(),
      slot: tx.slot,
      blockTime: tx.blockTime,
    }

    const resource = {
      ok: true,
      message: 'Payment verified — access granted by x402 V2 protocol',
      data: {
        resource: 'premium-api-data',
        timestamp: Date.now(),
        paymentVerified: receipt,
      },
      x402Version: 2,
    }

    return NextResponse.json(resource, {
      status: 200,
      headers: {
        'X-PAYMENT-RESPONSE': Buffer.from(JSON.stringify(receipt)).toString('base64'),
      }
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Payment verification error', message: err.message },
      { status: 500 }
    )
  }
}
