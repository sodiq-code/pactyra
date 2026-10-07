import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { Connection, PublicKey } from '@solana/web3.js'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
const USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"

// The facilitator's wallet — receives the USDC payment.
// This is the PACTYRA devnet wallet.
const PAY_TO = process.env.PAY_TO || "4ZokQYezBqFkUUQVWi7axR2qT6SS3vm2Q37ZzdPwyiBN"

// Payment amount: 0.01 USDC (10,000 base units at 6 decimals)
const PAYMENT_AMOUNT = 10_000

/**
 * HTTP Payment Facilitator — Resource Endpoint
 *
 * Implements the x402 HTTP payment protocol:
 *
 * 1. No X-PAYMENT header → return 402 with payment requirements
 * 2. X-PAYMENT header → verify the Solana transaction on-chain
 *    - Check the transaction exists and is confirmed
 *    - Check it contains a SPL token transfer to PAY_TO
 *    - Check the amount matches PAYMENT_AMOUNT
 *    - Check the token mint is USDC
 * 3. If valid → return 200 with X-PAYMENT-RESPONSE
 * 4. If invalid → return 402 again
 */
export async function GET(request: NextRequest) {
  const paymentHeader = request.headers.get('x-payment')

  // --- No payment: return 402 with requirements ---
  if (!paymentHeader) {
    const requirements = {
      x402Version: 1,
      requires: [
        {
          scheme: 'exact',
          network: 'solana-devnet',
          asset: USDC_MINT,
          maxTotalAmount: {
            value: String(PAYMENT_AMOUNT),
            currency: 'USDC'
          },
          resource: request.url,
          payTo: PAY_TO,
          maxTimeoutSeconds: 60,
          description: 'PACTYRA-gated API resource. Pay 0.01 USDC to access.'
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

    // The X-PAYMENT header contains the Solana transaction signature
    const signature = paymentHeader

    // Fetch the transaction from Solana
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    })

    if (!tx) {
      return NextResponse.json(
        { error: 'Transaction not found', x402Version: 1 },
        { status: 402, headers: { 'WWW-Authenticate': 'x402' } }
      )
    }

    // Verify the transaction is confirmed (not failed)
    if (tx.meta?.err) {
      return NextResponse.json(
        { error: 'Transaction failed on-chain', details: tx.meta.err },
        { status: 402, headers: { 'WWW-Authenticate': 'x402' } }
      )
    }

    // Check if the transaction includes a token transfer to PAY_TO
    // We look at the token balances changes
    const preTokenBalances = tx.meta?.preTokenBalances || []
    const postTokenBalances = tx.meta?.postTokenBalances || []

    let validPayment = false
    let paidAmount = 0

    // Find the payee's token account and check if it received USDC
    for (const post of postTokenBalances) {
      const pre = preTokenBalances.find(
        p => p.accountIndex === post.accountIndex
      )
      const preAmount = pre ? BigInt(pre.uiTokenAmount.amount) : 0n
      const postAmount = BigInt(post.uiTokenAmount.amount)
      const diff = postAmount - preAmount

      // Check if this account belongs to PAY_TO and received the right amount
      if (diff > 0n && post.owner === PAY_TO && post.mint === USDC_MINT) {
        paidAmount = Number(diff)
        if (paidAmount >= PAYMENT_AMOUNT) {
          validPayment = true
          break
        }
      }
    }

    // Also check the transaction instructions for a token transfer
    if (!validPayment) {
      // Check inner instructions (token transfers are often in inner instructions)
      const innerInstructions = tx.meta?.innerInstructions || []
      for (const inner of innerInstructions) {
        for (const ix of inner.instructions) {
          // Token Transfer instruction: first 1 byte is instruction type (3 = transfer)
          // Then 8 bytes (amount), then...
          if (ix.programId) {
            // We already checked token balances above, so if we reach here
            // it means the balance check didn't find a valid payment
          }
        }
      }
    }

    if (!validPayment) {
      return NextResponse.json(
        {
          error: 'Payment verification failed',
          details: `Expected ${PAYMENT_AMOUNT} USDC to ${PAY_TO}`,
          paidAmount,
          x402Version: 1
        },
        { status: 402, headers: { 'WWW-Authenticate': 'x402' } }
      )
    }

    // --- Payment verified: return the resource ---
    const resource = {
      ok: true,
      message: 'Payment verified — access granted by x402 protocol',
      data: {
        resource: 'premium-api-data',
        timestamp: Date.now(),
        paymentVerified: {
          signature,
          amount: paidAmount,
          currency: 'USDC',
          payTo: PAY_TO,
        }
      },
      x402Version: 1,
    }

    return NextResponse.json(resource, {
      status: 200,
      headers: {
        'X-PAYMENT-RESPONSE': Buffer.from(JSON.stringify({
          signature,
          amount: paidAmount,
          currency: 'USDC',
        })).toString('base64'),
      }
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Payment verification error', message: err.message },
      { status: 500 }
    )
  }
}
