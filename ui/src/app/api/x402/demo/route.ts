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
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
const PAY_TO = process.env.PAY_TO || "4ZokQYezBqFkUUQVWi7axR2qT6SS3vm2Q37ZzdPwyiBN"
const PAYMENT_AMOUNT = 10_000 // 0.01 USDC
const PERMANENT_AGENT = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'

/**
 * x402 V2 Server-Side Demo with PACTYRA Capability Enforcement
 *
 * Performs the complete x402 V2 flow:
 * 1. Fetch the resource → get 402 with x402 V2 requirements
 * 2. Verify PACTYRA capability on-chain (tier, bond, status, amount limit)
 * 3. Create and submit REAL SPL token transfer (USDC)
 * 4. Encode payment as base64 JSON per x402 V2 spec
 * 5. Retry request with X-PAYMENT header
 * 6. Facilitator verifies on-chain → returns 200 + X-PAYMENT-RESPONSE
 */
export async function GET(request: NextRequest) {
  const steps: any[] = []

  try {
    if (!process.env.SOLANA_WALLET_SECRET_KEY) {
      return NextResponse.json(
        { error: 'SOLANA_WALLET_SECRET_KEY not configured' },
        { status: 500 }
      )
    }

    const url = new URL(request.url)
    const resourceUrl = `${url.protocol}//${url.host}/api/x402/resource`

    const secretKey = JSON.parse(process.env.SOLANA_WALLET_SECRET_KEY)
    const payer = Keypair.fromSecretKey(Buffer.from(secretKey))
    const connection = new Connection(DEVNET_RPC, 'confirmed')

    steps.push({ step: 1, action: 'Load payer wallet', result: 'success', payer: payer.publicKey.toString() })

    // Step 2: Verify PACTYRA capability on-chain
    // This checks the agent's real on-chain state: tier, bond, status, and amount limit
    const PACTYRA_CORE = new PublicKey('EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC')
    const agentId = Buffer.from(PERMANENT_AGENT, 'hex')
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), agentId], PACTYRA_CORE
    )

    // Load the IDL and fetch the agent account directly from Solana
    const idl: Idl = require('@/lib/idl/pactyra_core.json')
    const provider = new AnchorProvider(connection, { publicKey: payer.publicKey } as any, { commitment: 'confirmed' })
    const program = new Program(idl, provider)

    let agentData: any
    try {
      agentData = await program.account.agent.fetch(agentPda)
    } catch {
      return NextResponse.json({ error: 'Agent not found on devnet', steps })
    }

    // Verify PACTYRA capability conditions by reading the agent's on-chain state.
    // The SDK adapter (sdk/src/adapters/x402.ts) calls the actual
    // assert_capability() instruction which performs all 14 security checks.
    // This server-side demo performs 3 of those checks by reading the agent
    // account directly — sufficient for the demo flow, but the SDK adapter
    // is the full enforcement primitive.
    const tierName = agentData.tier.probation ? 'Probation'
      : agentData.tier.proven ? 'Proven'
      : agentData.tier.trusted ? 'Trusted' : 'Unknown'
    const tierMax = agentData.tier.probation ? 5_000_000
      : agentData.tier.proven ? 50_000_000
      : 500_000_000
    const isActive = !!agentData.status.active
    const bondAmount = agentData.bondAmount.toNumber()
    const minBondRequired = 5_000_000 // 5 USDC minimum

    // Check 1: Agent must be Active
    if (!isActive) {
      steps.push({ step: 2, action: 'PACTYRA capability check', result: 'failed', error: 'AgentFrozen' })
      return NextResponse.json({ error: 'Agent is frozen — cannot assert capability', steps })
    }

    // Check 2: Bond must be satisfied
    if (bondAmount < minBondRequired) {
      steps.push({ step: 2, action: 'PACTYRA capability check', result: 'failed', error: 'BondNotSatisfied' })
      return NextResponse.json({ error: 'Bond not satisfied — cannot assert capability', steps })
    }

    // Check 3: Amount must be within tier limit
    if (PAYMENT_AMOUNT > tierMax) {
      steps.push({ step: 2, action: 'PACTYRA capability check', result: 'failed', error: 'AmountExceedsTier' })
      return NextResponse.json({ error: 'Amount exceeds tier limit', steps })
    }

    steps.push({
      step: 2,
      action: 'PACTYRA capability verification (on-chain state check)',
      result: 'passed',
      tier: tierName,
      tierMax: tierMax / 1_000_000 + ' USDC',
      bond: bondAmount / 1_000_000 + ' USDC',
      status: 'Active',
      epoch: agentData.currentEpoch.toNumber(),
      checks: ['Agent is Active', 'Bond satisfied (≥ 5 USDC)', 'Amount within tier limit'],
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
      action: 'Request resource → 402 Payment Required (x402 V2)',
      result: 'success',
      x402Version: paymentReq.x402Version,
      scheme: requirement.scheme,
      network: requirement.network,
      payTo: requirement.payTo,
      amount: parseInt(requirement.maxTotalAmount.value) / 1_000_000 + ' USDC',
    })

    // Step 4: Make the REAL USDC payment
    const payTo = new PublicKey(requirement.payTo)

    const payerTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT, payer.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    )
    const payeeTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT, payTo, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    )

    const transaction = new Transaction()

    const payeeAccountInfo = await connection.getAccountInfo(payeeTokenAccount)
    if (!payeeAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey, payeeTokenAccount, payTo, USDC_MINT,
          TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
        )
      )
    }

    transaction.add(
      createTransferInstruction(
        payerTokenAccount, payeeTokenAccount, payer.publicKey,
        PAYMENT_AMOUNT, [], TOKEN_PROGRAM_ID
      )
    )

    const { blockhash } = await connection.getLatestBlockhash('confirmed')
    transaction.recentBlockhash = blockhash
    transaction.feePayer = payer.publicKey

    const signature = await sendAndConfirmTransaction(connection, transaction, [payer])

    steps.push({
      step: 4,
      action: 'REAL USDC payment submitted to Solana',
      result: 'success',
      signature,
      amount: PAYMENT_AMOUNT / 1_000_000 + ' USDC',
      payer: payer.publicKey.toString(),
      payTo: requirement.payTo,
      explorerUrl: `https://solana.fm/tx/${signature}?cluster=devnet`,
    })

    // Step 5: Retry with X-PAYMENT header (base64-encoded JSON per x402 V2 spec)
    const paymentPayload = {
      signature,
      network: requirement.network,
      requirement: requirement,
    }
    const xPaymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64')

    const paidResponse = await fetch(resourceUrl, {
      headers: {
        'X-PAYMENT': xPaymentHeader,
      },
    })

    const paidData = await paidResponse.json()

    // Decode X-PAYMENT-RESPONSE
    let receipt: any = null
    const receiptHeader = paidResponse.headers.get('x-payment-response')
    if (receiptHeader) {
      try {
        receipt = JSON.parse(Buffer.from(receiptHeader, 'base64').toString())
      } catch {}
    }

    steps.push({
      step: 5,
      action: 'Retry with X-PAYMENT (base64 JSON per x402 V2 spec)',
      result: paidResponse.status === 200 ? 'verified' : 'failed',
      httpStatus: paidResponse.status,
      x402Version: paidData.x402Version,
      paymentVerified: paidData.data?.paymentVerified || receipt,
      xPaymentResponse: receipt,
    })

    return NextResponse.json({
      ok: paidResponse.status === 200,
      message: paidResponse.status === 200
        ? 'x402 V2 flow complete — REAL payment verified on-chain'
        : 'x402 V2 flow failed at verification step',
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
