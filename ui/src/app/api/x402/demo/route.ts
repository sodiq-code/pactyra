import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
} from '@solana/web3.js'
import {
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token'
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
const PAY_TO = process.env.PAY_TO || "4ZokQYezBqFkUUQVWi7axR2qT6SS3vm2Q37ZzdPwyiBN"
const PAYMENT_AMOUNT = 10_000 // 0.01 USDC
const PERMANENT_AGENT = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'

/**
 * x402 V2 Server-Side Demo with REAL PACTYRA assert_capability() Enforcement
 *
 * This endpoint calls the actual pactyra-core::assert_capability() instruction
 * on Solana devnet before making the USDC payment. This is NOT a mirror of
 * checks — it is the real on-chain enforcement primitive.
 *
 * Flow:
 * 1. Load payer wallet (the agent's authority_root)
 * 2. Ensure a capability exists for this x402 payment (create if needed)
 * 3. Call assert_capability() — creates Execution PDA, verifies 12+ security checks
 * 4. If assert_capability PASSES → make the REAL USDC payment
 * 5. If assert_capability FAILS → no payment is made
 * 6. Retry the x402 resource with the payment proof
 *
 * GET /api/x402/demo
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

    // Create anchor wallet for signing
    const anchorWallet = {
      publicKey: payer.publicKey,
      signTransaction: async (tx: any) => { tx.sign(payer); return tx },
      signAllTransactions: async (txs: any[]) => { txs.forEach(t => t.sign(payer)); return txs },
    }
    const provider = new AnchorProvider(connection, anchorWallet as any, { commitment: 'confirmed' })
    const idl: Idl = require('@/lib/idl/pactyra_core.json')
    const program = new Program(idl, provider)

    steps.push({ step: 1, action: 'Load payer wallet (agent authority_root)', result: 'success', payer: payer.publicKey.toString() })

    // Step 2: Derive PDAs
    const agentId = Buffer.from(PERMANENT_AGENT, 'hex')
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), agentId], program.programId
    )
    const [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), Buffer.from('PAY-V1')], program.programId
    )

    // For x402, the target is the payTo wallet (where USDC goes)
    const payToPubkey = new PublicKey(PAY_TO)

    // Fetch agent to get current epoch
    const agentData = await program.account.agent.fetch(agentPda)
    const epoch = agentData.currentEpoch.toNumber()

    // Derive capability PDA (targeted at payTo for this epoch)
    const [capabilityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('capability'), agentId, new BN(epoch).toArrayLike(Buffer, 'le', 8), payToPubkey.toBuffer()],
      program.programId
    )

    // Step 2: Ensure capability exists (create if needed)
    let capabilityExists = false
    try {
      await program.account.capability.fetch(capabilityPda)
      capabilityExists = true
    } catch {
      // Capability doesn't exist — create it
    }

    if (!capabilityExists) {
      try {
        await program.methods
          .requestCapability({
            capabilityType: { payService: {} },
            targetProgram: payToPubkey,
            targetAccount: payToPubkey,
            amountLimit: new BN(5_000_000),
            frequencyLimit: new BN(1000),
            ttlSeconds: new BN(86400 * 30), // 30 days
          })
          .accounts({
            agent: agentPda,
            policy: policyPda,
            capability: capabilityPda,
            authorityRoot: payer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
      } catch (e: any) {
        // Capability might already exist (race condition)
      }
    }

    // Step 3: Call REAL assert_capability() on-chain
    // This is the actual PACTYRA enforcement primitive — not a mirror of checks.
    // It verifies: agent active, capability active, epoch current, policy matches,
    // policy active, capability not expired, action type matches, target matches,
    // amount within limit, bond satisfied, delegate scope valid.
    // It also creates the Execution PDA and ConsumedNonce PDA.
    const actionNonce = new BN(Math.floor(Date.now() / 1000))

    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('nonce'), agentId, actionNonce.toArrayLike(Buffer, 'le', 8)],
      program.programId
    )
    const [executionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('execution'), agentId, actionNonce.toArrayLike(Buffer, 'le', 8)],
      program.programId
    )

    // Derive delegate_scope PDA (required by Anchor seeds constraint, even when Optional)
    const [delegateScopePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('delegate_scope'), agentId], program.programId
    )

    let assertSig: string
    try {
      assertSig = await program.methods
        .assertCapability({
          actionType: { payService: {} },
          targetProgram: payToPubkey,
          targetAccount: payToPubkey,
          amount: new BN(PAYMENT_AMOUNT),
          actionNonce: actionNonce,
        })
        .accounts({
          agent: agentPda,
          capability: capabilityPda,
          policy: policyPda,
          consumedNonce: consumedNoncePda,
          execution: executionPda,
          authorityRoot: payer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: delegateScopePda, isSigner: false, isWritable: false },
        ])
        .rpc()
    } catch (e: any) {
      steps.push({
        step: 2,
        action: 'PACTYRA assert_capability() — REAL on-chain enforcement',
        result: 'failed',
        error: e.message?.slice(0, 200),
        capabilityPda: capabilityPda.toString(),
      })
      return NextResponse.json({
        ok: false,
        message: 'assert_capability() rejected the action — payment NOT made',
        steps,
      })
    }

    steps.push({
      step: 2,
      action: 'PACTYRA assert_capability() — REAL on-chain enforcement',
      result: 'passed',
      signature: assertSig,
      capabilityPda: capabilityPda.toString(),
      executionPda: executionPda.toString(),
      explorerUrl: `https://solana.fm/tx/${assertSig}?cluster=devnet`,
      checks: [
        'Agent is Active (not Frozen)',
        'Capability is Active (not Revoked)',
        'Capability belongs to this Agent',
        'Authority epoch is current',
        'Policy matches capability',
        'Policy is Active (not Superseded)',
        'Capability not expired (TTL)',
        'Action type matches capability (PayService)',
        'Target program matches capability',
        'Target account matches capability',
        'Amount within capability limit',
        'Bond satisfied (≥ 5 USDC)',
      ],
      note: 'Execution PDA created with deterministic action_id — binding this assertion to the exact action',
    })

    // Step 3: Make initial x402 request — expect 402
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

    // Step 4: Make the REAL USDC payment (only reached if assert_capability passed)
    const payerTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT, payer.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    )
    const payeeTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT, payToPubkey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    )

    const transaction = new Transaction()

    const payeeAccountInfo = await connection.getAccountInfo(payeeTokenAccount)
    if (!payeeAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey, payeeTokenAccount, payToPubkey, USDC_MINT,
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

    const paymentSig = await sendAndConfirmTransaction(connection, transaction, [payer])

    steps.push({
      step: 4,
      action: 'REAL USDC payment submitted to Solana (after assert_capability passed)',
      result: 'success',
      signature: paymentSig,
      amount: PAYMENT_AMOUNT / 1_000_000 + ' USDC',
      payer: payer.publicKey.toString(),
      payTo: PAY_TO,
      explorerUrl: `https://solana.fm/tx/${paymentSig}?cluster=devnet`,
    })

    // Step 5: Retry with X-PAYMENT header (base64-encoded JSON per x402 V2 spec)
    const paymentPayload = {
      signature: paymentSig,
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
    })

    return NextResponse.json({
      ok: paidResponse.status === 200,
      message: paidResponse.status === 200
        ? 'x402 V2 flow complete — assert_capability() enforced before REAL payment verified on-chain'
        : 'x402 V2 flow failed at verification step',
      steps,
      assertSignature: assertSig,
      paymentSignature: paymentSig,
      explorerUrl: `https://solana.fm/tx/${paymentSig}?cluster=devnet`,
    })
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
      steps,
    }, { status: 500 })
  }
}
