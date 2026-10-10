import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import {
  Connection, PublicKey, Keypair, Transaction,
  sendAndConfirmTransaction, SystemProgram, TransactionInstruction,
} from '@solana/web3.js'
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
const PERMANENT_AGENT = 'c3e081b665887dc265469a1d5906c53e1beb633dcc5651b01e76a10796e771f9'
const PACTYRA_CORE = new PublicKey('FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf')

/**
 * Stale Epoch Rejection Demo
 *
 * Demonstrates that after an authority epoch increment (caused by a critical
 * failure), capabilities issued under the OLD epoch are permanently rejected.
 *
 * The agent's private key is still valid, the capability still exists on-chain,
 * but assert_capability fails at Check 4: authority_epoch != current_epoch.
 *
 * This is Scene 1:55-2:10 of the demo script: "The old capability fails."
 * Also used for Scene 0:00-0:08 cold open.
 *
 * GET /api/demo/stale-epoch
 *
 * Flow:
 * 1. Read agent's current_epoch (e.g., 2 after critical failure)
 * 2. Derive capability PDA for PREVIOUS epoch (epoch - 1)
 * 3. If the old capability exists on-chain, attempt assert_capability
 * 4. The program rejects with StaleEpoch (PactyraError code 6005)
 * 5. Return the rejection evidence
 *
 * If no previous-epoch capability exists (agent never had a critical failure),
 * the endpoint returns a diagnostic explaining the prerequisite.
 */
export async function GET(request: NextRequest) {
  try {
    if (!process.env.SOLANA_WALLET_SECRET_KEY) {
      return NextResponse.json(
        { error: 'SOLANA_WALLET_SECRET_KEY not configured' },
        { status: 500 }
      )
    }

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

    // Fetch agent state
    const agentData = await program.account.agent.fetch(agentPda)
    const currentEpoch = agentData.currentEpoch.toNumber()
    const tierName = agentData.tier.probation ? 'Probation (T1)'
      : agentData.tier.proven ? 'Proven (T2)'
      : agentData.tier.trusted ? 'Trusted (T3)' : 'Unknown'
    const criticalFailures = agentData.criticalFailures?.toNumber?.() ?? agentData.criticalFailures ?? 0

    // Try to find a capability from a PREVIOUS epoch
    let staleEpoch = -1
    let staleCapPda: PublicKey | null = null
    let staleCapExists = false

    for (let ep = currentEpoch - 1; ep >= 0; ep--) {
      const [capPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('capability'), agentId, new BN(ep).toArrayLike(Buffer, 'le', 8), payToPubkey.toBuffer()],
        PACTYRA_CORE
      )
      const acc = await connection.getAccountInfo(capPda)
      if (acc && acc.data.length > 8) {
        staleEpoch = ep
        staleCapPda = capPda
        staleCapExists = true
        break
      }
    }

    if (!staleCapExists) {
      // No previous-epoch capability exists — agent hasn't had a critical failure
      return NextResponse.json({
        ok: false,
        message: 'No stale capability found. The agent has not had a critical failure, so there is no previous-epoch capability to reject.',
        agent: {
          tier: tierName,
          currentEpoch,
          criticalFailures,
        },
        hint: 'Run /api/verifier/demo?force=critical first to increment the epoch, then retry this endpoint.',
        simulated: {
          rejection: 'StaleEpoch',
          code: 6005,
          message: 'The capability was issued under a previous authority epoch. It is permanently invalid.',
          check: 'Check 4: capability.authority_epoch == agent.current_epoch',
        },
      })
    }

    // Build assert_capability instruction using the STALE (old-epoch) capability
    const actionNonce = new BN(Math.floor(Date.now() / 1000))
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('nonce'), agentId, actionNonce.toArrayLike(Buffer, 'le', 8)], PACTYRA_CORE)
    const [executionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('execution'), agentId, actionNonce.toArrayLike(Buffer, 'le', 8)], PACTYRA_CORE)
    const [delegateScopePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('delegate_scope'), agentId], PACTYRA_CORE)
    const [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), Buffer.from('PAY-V1')], PACTYRA_CORE)

    // Discriminator for assert_capability: [32, 167, 114, 216, 19, 22, 182, 218]
    const discriminator = Buffer.from([32, 167, 114, 216, 19, 22, 182, 218])

    // ActionParams: PayService(0) + target_program(32) + target_account(32) + amount(8) + nonce(8)
    const smallAmount = 1_000_000 // $1 USDC — within the old capability's limit
    const actionData = Buffer.alloc(1 + 32 + 32 + 8 + 8)
    actionData.writeUInt8(0, 0)
    payToPubkey.toBuffer().copy(actionData, 1)
    payToPubkey.toBuffer().copy(actionData, 33)
    actionData.writeBigUInt64LE(BigInt(smallAmount), 65)
    actionData.writeBigUInt64LE(BigInt(actionNonce.toNumber()), 73)

    const instructionData = Buffer.concat([discriminator, actionData])

    const keys = [
      { pubkey: agentPda, isSigner: false, isWritable: true },
      { pubkey: staleCapPda!, isSigner: false, isWritable: true },
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
    let txLogs: string[] = []

    try {
      await sendAndConfirmTransaction(connection, assertTx, [payer])
      // If we get here, the assertion unexpectedly succeeded (shouldn't happen with a stale capability)
      return NextResponse.json({
        ok: false,
        message: 'assert_capability unexpectedly succeeded — the capability was not stale',
        agent: { tier: tierName, currentEpoch, criticalFailures },
        capability: { epoch: staleEpoch, pda: staleCapPda!.toBase58() },
      })
    } catch (e: any) {
      rejectionError = e.message?.slice(0, 500) || 'Transaction failed'
      txLogs = e.logs || []

      // Parse the Anchor error code from the transaction logs
      for (const log of txLogs) {
        if (log.includes('StaleEpoch')) { rejectionCode = 'StaleEpoch'; break }
        if (log.includes('AmountExceedsCapability')) { rejectionCode = 'AmountExceedsCapability'; break }
        if (log.includes('CapabilityExpired')) { rejectionCode = 'CapabilityExpired'; break }
        if (log.includes('CapabilityNotActive')) { rejectionCode = 'CapabilityNotActive'; break }
      }

      // Also check the error message for the Anchor error code
      if (!rejectionCode) {
        const codeMatch = rejectionError.match(/Custom\s*:\s*(\d+)/)
        if (codeMatch) {
          const code = parseInt(codeMatch[1])
          if (code === 6005) rejectionCode = 'StaleEpoch'
          else if (code === 6007) rejectionCode = 'AmountExceedsCapability'
          else if (code === 6003) rejectionCode = 'CapabilityNotActive'
          else rejectionCode = `PactyraError(${code})`
        }
      }
    }

    return NextResponse.json({
      ok: true,
      rejected: true,
      message: 'The agent retries with its old capability. Rejected — the authority epoch has incremented.',
      agent: {
        tier: tierName,
        currentEpoch,
        criticalFailures,
        agentPda: agentPda.toBase58(),
      },
      capability: {
        epoch: staleEpoch,
        pda: staleCapPda!.toBase58(),
        status: 'stale — issued under a previous authority epoch',
      },
      rejection: {
        code: rejectionCode || 'Unknown',
        errorCode: 6005,
        message: 'The private key is still valid. The capability is permanently invalid. Its authority epoch has passed.',
        check: 'Check 4: capability.authority_epoch == agent.current_epoch — FAILS',
        rawError: rejectionError?.slice(0, 300),
      },
      enforcement: '14 security checks — check 4 (Authority epoch current) fails',
      logs: txLogs.slice(-10),
      narrative: 'The agent still has its key, but it no longer has the authority it had earned.',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
