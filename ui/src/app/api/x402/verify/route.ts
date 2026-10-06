import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { Connection, PublicKey } from '@solana/web3.js'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
const USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
const PAY_TO = process.env.PAY_TO || "A55wG1G5nLVxn9Ns91ogrqZ6cHVi2yPd7WRi8GCyc3PE"

/**
 * x402 V2 Facilitator — Payment Verification Endpoint
 *
 * Called by the x402 adapter (or any x402 client) to verify a payment
 * before retrying the request with the X-PAYMENT header.
 *
 * POST /api/x402/verify
 * Body: { signature, payTo, amount, asset }
 *
 * Returns: { valid: true/false, details }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { signature, payTo, amount, asset } = body

    if (!signature) {
      return NextResponse.json(
        { valid: false, error: 'Missing transaction signature' },
        { status: 400 }
      )
    }

    const connection = new Connection(DEVNET_RPC, 'confirmed')

    // Fetch the transaction
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    })

    if (!tx) {
      return NextResponse.json({
        valid: false,
        error: 'Transaction not found on-chain',
      })
    }

    // Check transaction succeeded
    if (tx.meta?.err) {
      return NextResponse.json({
        valid: false,
        error: 'Transaction failed on-chain',
        details: JSON.stringify(tx.meta.err),
      })
    }

    // Verify token transfer to payTo
    const preTokenBalances = tx.meta?.preTokenBalances || []
    const postTokenBalances = tx.meta?.postTokenBalances || []

    let validPayment = false
    let paidAmount = 0

    for (const post of postTokenBalances) {
      const pre = preTokenBalances.find(
        p => p.accountIndex === post.accountIndex
      )
      const preAmount = pre ? BigInt(pre.uiTokenAmount.amount) : 0n
      const postAmount = BigInt(post.uiTokenAmount.amount)
      const diff = postAmount - preAmount

      if (diff > 0n && post.owner === payTo && post.mint === asset) {
        paidAmount = Number(diff)
        if (paidAmount >= amount) {
          validPayment = true
          break
        }
      }
    }

    return NextResponse.json({
      valid: validPayment,
      signature,
      paidAmount,
      expectedAmount: amount,
      payTo,
      asset,
      slot: tx.slot,
      blockTime: tx.blockTime,
    })
  } catch (err: any) {
    return NextResponse.json(
      { valid: false, error: err.message },
      { status: 500 }
    )
  }
}
