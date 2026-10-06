import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import {
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
const PAY_TO = process.env.PAY_TO || "A55wG1G5nLVxn9Ns91ogrqZ6cHVi2yPd7WRi8GCyc3PE"
const PAYMENT_AMOUNT = 10_000 // 0.01 USDC

/**
 * x402 V2 Server-Side Demo
 *
 * Performs the complete x402 flow server-side:
 * 1. Fetch the resource → get 402 Payment Required
 * 2. Check PACTYRA agent state (capability check)
 * 3. Create and submit REAL SPL token transfer (USDC)
 * 4. Retry request with REAL transaction signature
 * 5. Return the verified result
 *
 * GET /api/x402/demo
 */
export async function GET(request: NextRequest) {
  const steps: any[] = []

  try {
    // Load the wallet keypair from env var
    if (!process.env.SOLANA_WALLET_SECRET_KEY) {
      return NextResponse.json(
        { error: 'SOLANA_WALLET_SECRET_KEY not configured' },
        { status: 500 }
      )
    }

    // Construct the resource URL dynamically from the request
    const url = new URL(request.url)
    const resourceUrl = `${url.protocol}//${url.host}/api/x402/resource`

    const secretKey = JSON.parse(process.env.SOLANA_WALLET_SECRET_KEY)
    const payer = Keypair.fromSecretKey(Buffer.from(secretKey))
    const connection = new Connection(DEVNET_RPC, 'confirmed')

    steps.push({ step: 1, action: 'Load payer wallet', result: 'success', payer: payer.publicKey.toString() })

    // Step 2: Check PACTYRA agent state
    const PERMANENT_AGENT = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
    const agentRes = await fetch(`${url.protocol}//${url.host}/api/agent?id=${PERMANENT_AGENT}`)
    const agentData = await agentRes.json()

    if (!agentData.found) {
      return NextResponse.json({ error: 'Agent not found', steps })
    }

    steps.push({
      step: 2,
      action: 'Check PACTYRA agent state',
      result: 'success',
      tier: agentData.tier,
      status: agentData.status,
      maxAmount: agentData.maxAmount,
      bondAmount: agentData.bondAmount / 1_000_000,
    })

    // Step 3: Make initial request — expect 402
    const initialResponse = await fetch(resourceUrl)

    if (initialResponse.status !== 402) {
      return NextResponse.json({
        error: `Expected 402, got ${initialResponse.status}`,
        steps,
      })
    }

    const paymentReq = await initialResponse.json()
    const requirement = paymentReq.requires?.[0]

    steps.push({
      step: 3,
      action: 'Request x402 resource → 402 Payment Required',
      result: 'success',
      scheme: requirement.scheme,
      network: requirement.network,
      payTo: requirement.payTo,
      amount: parseInt(requirement.maxTotalAmount.value) / 1_000_000 + ' USDC',
    })

    // Step 4: PACTYRA capability check
    const tierMax = agentData.tier === 'Probation' ? 5_000_000
      : agentData.tier === 'Proven' ? 50_000_000
      : 500_000_000

    const requiredAmount = parseInt(requirement.maxTotalAmount.value)

    if (requiredAmount > tierMax) {
      steps.push({
        step: 4,
        action: 'PACTYRA capability check',
        result: 'failed',
        error: 'AmountExceedsCapability',
      })
      return NextResponse.json({ error: 'Capability check failed', steps })
    }

    steps.push({
      step: 4,
      action: 'PACTYRA capability check',
      result: 'passed',
      tier: agentData.tier,
      tierMax: tierMax / 1_000_000 + ' USDC',
      required: requiredAmount / 1_000_000 + ' USDC',
    })

    // Step 5: Make the REAL USDC payment
    const payTo = new PublicKey(requirement.payTo)

    // Get the payer's USDC token account
    const payerTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT, payer.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    )

    // Get the payee's USDC token account
    const payeeTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT, payTo, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    )

    // Check if payer has USDC
    const payerTokenInfo = await connection.getAccountInfo(payerTokenAccount)
    if (!payerTokenInfo) {
      return NextResponse.json({
        error: 'Payer does not have a USDC token account',
        payerTokenAccount: payerTokenAccount.toString(),
        steps,
      })
    }

    const transaction = new Transaction()

    // Create payee token account if needed
    const payeeAccountInfo = await connection.getAccountInfo(payeeTokenAccount)
    if (!payeeAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey, payeeTokenAccount, payTo, USDC_MINT,
          TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
        )
      )
    }

    // Add the USDC transfer instruction
    transaction.add(
      createTransferInstruction(
        payerTokenAccount, payeeTokenAccount, payer.publicKey,
        requiredAmount, [], TOKEN_PROGRAM_ID
      )
    )

    // Get blockhash and sign
    const { blockhash } = await connection.getLatestBlockhash('confirmed')
    transaction.recentBlockhash = blockhash
    transaction.feePayer = payer.publicKey

    // Submit the REAL transaction
    const signature = await sendAndConfirmTransaction(connection, transaction, [payer])

    steps.push({
      step: 5,
      action: 'REAL USDC payment submitted to Solana',
      result: 'success',
      signature,
      amount: requiredAmount / 1_000_000 + ' USDC',
      payer: payer.publicKey.toString(),
      payTo: requirement.payTo,
      explorerUrl: `https://solana.fm/tx/${signature}?cluster=devnet`,
    })

    // Step 6: Retry request with payment proof
    const paidResponse = await fetch(resourceUrl, {
      headers: {
        'X-PAYMENT': signature,
        'X-PAYMENT-NETWORK': requirement.network,
      },
    })

    const paidData = await paidResponse.json()

    steps.push({
      step: 6,
      action: 'Retry request with X-PAYMENT header',
      result: paidResponse.status === 200 ? 'verified' : 'failed',
      httpStatus: paidResponse.status,
      data: paidData,
      paymentVerified: paidData.data?.paymentVerified || null,
      xPaymentResponse: paidResponse.headers.get('x-payment-response') || null,
    })

    return NextResponse.json({
      ok: paidResponse.status === 200,
      message: paidResponse.status === 200
        ? 'x402 V2 flow complete — REAL payment verified on-chain'
        : 'x402 flow failed at verification step',
      steps,
      signature,
      explorerUrl: `https://solana.fm/tx/${signature}?cluster=devnet`,
    })
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
      steps,
    }, { status: 500 })
  }
}
