import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import {
  Connection, PublicKey, Keypair, Transaction,
  sendAndConfirmTransaction, SystemProgram, TransactionInstruction,
} from '@solana/web3.js'
import {
  createTransferInstruction, createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress,
} from '@solana/spl-token'
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor'
import * as borsh from 'borsh'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
const PAY_TO = process.env.PAY_TO || "4ZokQYezBqFkUUQVWi7axR2qT6SS3vm2Q37ZzdPwyiBN"
const PAYMENT_AMOUNT = 10_000
const PERMANENT_AGENT = '3482807cb77c749b30a3743330e0096b0d19482708c55c21d085cdad835dff53'
const PACTYRA_CORE = new PublicKey('FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf')

export async function GET(request: NextRequest) {
  const steps: any[] = []
  try {
    if (!process.env.SOLANA_WALLET_SECRET_KEY) {
      return NextResponse.json({ error: 'SOLANA_WALLET_SECRET_KEY not configured' }, { status: 500 })
    }
    const url = new URL(request.url)
    const resourceUrl = `${url.protocol}//${url.host}/api/x402/resource`
    const secretKey = JSON.parse(process.env.SOLANA_WALLET_SECRET_KEY)
    const payer = Keypair.fromSecretKey(Buffer.from(secretKey))
    const connection = new Connection(DEVNET_RPC, 'confirmed')

    const anchorWallet = {
      publicKey: payer.publicKey,
      signTransaction: async (tx: any) => { tx.sign(payer); return tx },
      signAllTransactions: async (txs: any[]) => { txs.forEach(t => t.sign(payer)); return txs },
    }
    const provider = new AnchorProvider(connection, anchorWallet as any, { commitment: 'confirmed' })
    const idl: Idl = require('@/lib/idl/pactyra_core.json')
    const program = new Program(idl, provider)

    steps.push({ step: 1, action: 'Load payer wallet', result: 'success', payer: payer.publicKey.toString() })

    const agentIdHex = url.searchParams.get('agentId') || PERMANENT_AGENT
    const agentId = Buffer.from(agentIdHex, 'hex')
    const [agentPda] = PublicKey.findProgramAddressSync([Buffer.from('agent'), agentId], PACTYRA_CORE)
    const [policyPda] = PublicKey.findProgramAddressSync([Buffer.from('policy'), Buffer.from('PAY-V1')], PACTYRA_CORE)
    const payToPubkey = new PublicKey(PAY_TO)

    const agentData = await program.account.agent.fetch(agentPda)
    const epoch = agentData.currentEpoch.toNumber()

    // Ensure capability exists (read raw account data — IDL has stale layout)
    const [capabilityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('capability'), agentId, new BN(epoch).toArrayLike(Buffer, 'le', 8), payToPubkey.toBuffer()], PACTYRA_CORE)

    // Call assert_capability using a RAW transaction (bypass Anchor SDK)
    // delegate_scope is Optional — since authority_root is signing, we don't
    // need to create or pass a DelegateScope PDA.
    const actionNonce = new BN(Math.floor(Date.now() / 1000))
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('nonce'), agentId, actionNonce.toArrayLike(Buffer, 'le', 8)], PACTYRA_CORE)
    const [executionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('execution'), agentId, actionNonce.toArrayLike(Buffer, 'le', 8)], PACTYRA_CORE)

    // Build the instruction data manually
    // Discriminator: [32, 167, 114, 216, 19, 22, 182, 218]
    // ActionParams: action_type (1 byte enum), target_program (32), target_account (32), amount (8), action_nonce (8)
    const discriminator = Buffer.from([32, 167, 114, 216, 19, 22, 182, 218])
    
    // Read target_account from the stored capability to ensure the assert matches
    let capAccount = await connection.getAccountInfo(capabilityPda)
    if (!capAccount) {
      try {
        await program.methods.requestCapability({
          capabilityType: { payService: {} }, targetProgram: payToPubkey, targetAccount: payToPubkey,
          amountLimit: new BN(5_000_000), frequencyLimit: new BN(1000), ttlSeconds: new BN(86400 * 30),
        }).accounts({ agent: agentPda, policy: policyPda, capability: capabilityPda,
          authorityRoot: payer.publicKey, systemProgram: SystemProgram.programId }).rpc()
        capAccount = await connection.getAccountInfo(capabilityPda)
      } catch {}
    }
    // Layout: disc(8) + cap_id(32) + agent_id(32) + cap_type(1) + target_program(32) + target_account(32)
    const storedTargetAccount = capAccount
      ? new PublicKey(capAccount.data.slice(8 + 32 + 32 + 1 + 32, 8 + 32 + 32 + 1 + 32 + 32))
      : payToPubkey

    // ActionParams struct (borsh serialized)
    // action_type: PayService = 0 (1 byte)
    // target_program: 32 bytes
    // target_account: 32 bytes (read from stored capability)
    // amount: 8 bytes (u64 LE)
    // action_nonce: 8 bytes (u64 LE)
    const actionData = Buffer.alloc(1 + 32 + 32 + 8 + 8)
    actionData.writeUInt8(0, 0) // PayService = 0
    payToPubkey.toBuffer().copy(actionData, 1) // target_program
    storedTargetAccount.toBuffer().copy(actionData, 33) // target_account (from stored capability)
    actionData.writeBigUInt64LE(BigInt(PAYMENT_AMOUNT), 65) // amount
    actionData.writeBigUInt64LE(BigInt(actionNonce.toNumber()), 73) // action_nonce

    const instructionData = Buffer.concat([discriminator, actionData])

    // Account order (from IDL):
    // 0: agent (mut)
    // 1: capability (mut)
    // 2: policy
    // 3: consumed_nonce (mut, init)
    // 4: execution (mut, init)
    // 5: delegate_scope (optional — not passed when authority_root signs)
    // 6: signer (signer, mut)
    // 7: system_program
    //
    // When delegate_scope is Optional and the signer is authority_root,
    // Anchor expects the account to still be in the account list but can
    // accept it as None. We pass the delegate_scope PDA address — Anchor
    // will check the seeds and determine it's Optional (account not
    // initialized → None).
    const [delegateScopePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('delegate_scope'), agentId], PACTYRA_CORE)
    const keys = [
      { pubkey: agentPda, isSigner: false, isWritable: true },
      { pubkey: capabilityPda, isSigner: false, isWritable: true },
      { pubkey: policyPda, isSigner: false, isWritable: false },
      { pubkey: consumedNoncePda, isSigner: false, isWritable: true },
      { pubkey: executionPda, isSigner: false, isWritable: true },
      { pubkey: delegateScopePda, isSigner: false, isWritable: false },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ]

    const assertIx = new TransactionInstruction({
      keys,
      programId: PACTYRA_CORE,
      data: instructionData,
    })

    const assertTx = new Transaction().add(assertIx)
    const { blockhash } = await connection.getLatestBlockhash('confirmed')
    assertTx.recentBlockhash = blockhash
    assertTx.feePayer = payer.publicKey

    let assertSig: string
    try {
      assertSig = await sendAndConfirmTransaction(connection, assertTx, [payer])
    } catch (e: any) {
      steps.push({ step: 2, action: 'assert_capability() (raw tx)', result: 'failed', error: e.message?.slice(0, 300) })
      return NextResponse.json({ ok: false, message: 'assert_capability() rejected', steps })
    }

    steps.push({
      step: 2, action: 'PACTYRA assert_capability() — REAL on-chain enforcement', result: 'passed',
      signature: assertSig, capabilityPda: capabilityPda.toString(), executionPda: executionPda.toString(),
      explorerUrl: `https://solana.fm/tx/${assertSig}?cluster=devnet`,
      checks: ['Agent is Active', 'Capability is Active', 'Capability belongs to Agent', 'Authority epoch current',
        'Policy matches', 'Policy is Active', 'Capability not expired', 'Action type matches',
        'Target program matches', 'Target account matches', 'Amount within limit', 'Bond satisfied',
        'Frequency limit not exceeded', 'Delegate scope valid'],
    })

    // x402 flow
    const initialResponse = await fetch(resourceUrl)
    if (initialResponse.status !== 402) {
      return NextResponse.json({ error: `Expected 402, got ${initialResponse.status}`, steps })
    }
    const paymentReq = await initialResponse.json()
    const requirement = paymentReq.requires?.[0]

    steps.push({ step: 3, action: 'Request resource → 402 Payment Required (x402 V2)', result: 'success',
      x402Version: paymentReq.x402Version, scheme: requirement.scheme, network: requirement.network,
      payTo: requirement.payTo, amount: parseInt(requirement.maxTotalAmount.value) / 1_000_000 + ' USDC' })

    // USDC payment
    const payerTokenAccount = await getAssociatedTokenAddress(USDC_MINT, payer.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
    const payeeTokenAccount = await getAssociatedTokenAddress(USDC_MINT, payToPubkey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
    const tx = new Transaction()
    const payeeInfo = await connection.getAccountInfo(payeeTokenAccount)
    if (!payeeInfo) {
      tx.add(createAssociatedTokenAccountInstruction(payer.publicKey, payeeTokenAccount, payToPubkey, USDC_MINT, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID))
    }
    tx.add(createTransferInstruction(payerTokenAccount, payeeTokenAccount, payer.publicKey, PAYMENT_AMOUNT, [], TOKEN_PROGRAM_ID))
    const { blockhash: bh2 } = await connection.getLatestBlockhash('confirmed')
    tx.recentBlockhash = bh2
    tx.feePayer = payer.publicKey
    const paymentSig = await sendAndConfirmTransaction(connection, tx, [payer])

    steps.push({ step: 4, action: 'REAL USDC payment (after assert_capability passed)', result: 'success',
      signature: paymentSig, amount: PAYMENT_AMOUNT / 1_000_000 + ' USDC',
      explorerUrl: `https://solana.fm/tx/${paymentSig}?cluster=devnet` })

    // Retry with X-PAYMENT
    const xPaymentHeader = Buffer.from(JSON.stringify({ signature: paymentSig, network: requirement.network, requirement })).toString('base64')
    const paidResponse = await fetch(resourceUrl, { headers: { 'X-PAYMENT': xPaymentHeader } })
    const paidData = await paidResponse.json()

    let receipt: any = null
    const receiptHeader = paidResponse.headers.get('x-payment-response')
    if (receiptHeader) { try { receipt = JSON.parse(Buffer.from(receiptHeader, 'base64').toString()) } catch {} }

    steps.push({ step: 5, action: 'Retry with X-PAYMENT (base64 JSON x402 V2)', result: paidResponse.status === 200 ? 'verified' : 'failed',
      httpStatus: paidResponse.status, x402Version: paidData.x402Version, paymentVerified: paidData.data?.paymentVerified || receipt })

    return NextResponse.json({
      ok: paidResponse.status === 200,
      message: paidResponse.status === 200 ? 'x402 V2 flow complete — assert_capability() enforced before REAL payment verified on-chain' : 'x402 V2 flow failed',
      steps, assertSignature: assertSig, assertExplorerUrl: `https://solana.fm/tx/${assertSig}?cluster=devnet`,
      paymentSignature: paymentSig, paymentExplorerUrl: `https://solana.fm/tx/${paymentSig}?cluster=devnet`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, steps }, { status: 500 })
  }
}
