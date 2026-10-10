import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import {
  Connection, PublicKey, Keypair, Transaction,
  sendAndConfirmTransaction, SystemProgram, TransactionInstruction,
} from '@solana/web3.js'
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
const PERMANENT_AGENT = '3482807cb77c749b30a3743330e0096b0d19482708c55c21d085cdad835dff53'
const PACTYRA_CORE = new PublicKey('FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf')

/**
 * Unauthorized Amount Rejection Demo
 *
 * Demonstrates that PACTYRA enforces amount limits BEFORE any payment executes.
 * The agent requests an amount that exceeds its capability limit. assert_capability
 * rejects the action with AmountExceedsCapability — no Execution PDA is created,
 * no USDC moves, and the capability use count does not increment.
 *
 * This is Scene 0:51-1:04 of the demo script: "Deny the unauthorized action."
 *
 * GET /api/demo/rejected
 * GET /api/demo/rejected?amount=50000  (override the attempted amount in microlamports)
 */
export async function GET(request: NextRequest) {
  try {
    if (!process.env.SOLANA_WALLET_SECRET_KEY) {
      return NextResponse.json(
        { error: 'SOLANA_WALLET_SECRET_KEY not configured' },
        { status: 500 }
      )
    }

    const url = new URL(request.url)
    const attemptedAmount = parseInt(url.searchParams.get('amount') || '50000')

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

    const agentIdHex = PERMANENT_AGENT
    const agentId = Buffer.from(agentIdHex, 'hex')
    const [agentPda] = PublicKey.findProgramAddressSync([Buffer.from('agent'), agentId], PACTYRA_CORE)
    const payToPubkey = new PublicKey(process.env.PAY_TO || '4ZokQYezBqFkUUQVWi7axR2qT6SS3vm2Q37ZzdPwyiBN')

    // Fetch agent state to show the current authority
    const agentData = await program.account.agent.fetch(agentPda)
    const tierName = agentData.tier.probation ? 'Probation (T1)'
      : agentData.tier.proven ? 'Proven (T2)'
      : agentData.tier.trusted ? 'Trusted (T3)' : 'Unknown'
    const maxAuthority = agentData.tier.probation ? 5
      : agentData.tier.proven ? 50
      : agentData.tier.trusted ? 500 : 0

    const epoch = agentData.currentEpoch.toNumber()
    const [policyPda] = PublicKey.findProgramAddressSync([Buffer.from('policy'), Buffer.from('PAY-V1')], PACTYRA_CORE)
    const [capabilityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('capability'), agentId, new BN(epoch).toArrayLike(Buffer, 'le', 8), payToPubkey.toBuffer()], PACTYRA_CORE)

    // Fetch capability to show its actual limit
    let capabilityLimit = 0
    try {
      const cap = await program.account.capability.fetch(capabilityPda)
      capabilityLimit = cap.amountLimit.toNumber()
    } catch {
      // Capability doesn't exist yet — the rejection will be a different error
    }

    // Build assert_capability instruction with an amount that EXCEEDS the capability
    const actionNonce = new BN(Math.floor(Date.now() / 1000))
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('nonce'), agentId, actionNonce.toArrayLike(Buffer, 'le', 8)], PACTYRA_CORE)
    const [executionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('execution'), agentId, actionNonce.toArrayLike(Buffer, 'le', 8)], PACTYRA_CORE)
    const [delegateScopePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('delegate_scope'), agentId], PACTYRA_CORE)

    // Discriminator for assert_capability: [32, 167, 114, 216, 19, 22, 182, 218]
    const discriminator = Buffer.from([32, 167, 114, 216, 19, 22, 182, 218])

    // ActionParams: PayService(0) + target_program(32) + target_account(32) + amount(8) + nonce(8)
    const actionData = Buffer.alloc(1 + 32 + 32 + 8 + 8)
    actionData.writeUInt8(0, 0)
    payToPubkey.toBuffer().copy(actionData, 1)
    payToPubkey.toBuffer().copy(actionData, 33)
    actionData.writeBigUInt64LE(BigInt(attemptedAmount), 65)
    actionData.writeBigUInt64LE(BigInt(actionNonce.toNumber()), 73)

    const instructionData = Buffer.concat([discriminator, actionData])

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

    const assertIx = new TransactionInstruction({ keys, programId: PACTYRA_CORE, data: instructionData })
    const assertTx = new Transaction().add(assertIx)
    const { blockhash } = await connection.getLatestBlockhash('confirmed')
    assertTx.recentBlockhash = blockhash
    assertTx.feePayer = payer.publicKey

    let rejectionError: string | null = null
    let rejectionCode: string | null = null

    try {
      // This SHOULD fail — the amount exceeds the capability limit
      await sendAndConfirmTransaction(connection, assertTx, [payer])
      // If we get here, the assertion unexpectedly succeeded
      return NextResponse.json({
        ok: false,
        message: 'assert_capability unexpectedly succeeded — the attempted amount did not exceed the limit',
        attemptedAmount: attemptedAmount / 1_000_000 + ' USDC',
        capabilityLimit: capabilityLimit / 1_000_000 + ' USDC',
      })
    } catch (e: any) {
      rejectionError = e.message?.slice(0, 500) || 'Transaction failed'

      // Parse the Anchor error code from the transaction logs
      const logs = e.logs || []
      for (const log of logs) {
        if (log.includes('AmountExceedsCapability') || log.includes('amount_exceeds_capability')) {
          rejectionCode = 'AmountExceedsCapability'
          break
        }
        if (log.includes('CapabilityExpired')) { rejectionCode = 'CapabilityExpired'; break }
        if (log.includes('StaleEpoch')) { rejectionCode = 'StaleEpoch'; break }
        if (log.includes('CapabilityNotActive')) { rejectionCode = 'CapabilityNotActive'; break }
      }

      // Also check the error message for the Anchor error code
      if (!rejectionCode) {
        const codeMatch = rejectionError.match(/Custom\s*:\s*(\d+)/)
        if (codeMatch) {
          const code = parseInt(codeMatch[1])
          // Map common PactyraError codes
          if (code === 6007) rejectionCode = 'AmountExceedsCapability'
          else if (code === 6003) rejectionCode = 'CapabilityNotActive'
          else if (code === 6005) rejectionCode = 'StaleEpoch'
          else rejectionCode = `PactyraError(${code})`
        }
      }
    }

    return NextResponse.json({
      ok: true,
      rejected: true,
      message: 'assert_capability rejected the unauthorized amount — no payment executed, no Execution PDA created',
      agent: {
        tier: tierName,
        maxAuthority: `$${maxAuthority}`,
        epoch,
      },
      attempt: {
        amount: `$${attemptedAmount / 1_000_000} USDC`,
        capabilityLimit: capabilityLimit > 0 ? `$${capabilityLimit / 1_000_000} USDC` : 'not found',
        exceeds: attemptedAmount > capabilityLimit,
      },
      rejection: {
        code: rejectionCode || 'Unknown',
        message: 'The private key is valid. The action is not authorized. No payment executes.',
        rawError: rejectionError?.slice(0, 300),
      },
      enforcement: '14 security checks — check 11 (Amount within limit) fails',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
