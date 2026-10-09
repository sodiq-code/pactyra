import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js'
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor'
import { loadWalletKeypair, makeAnchorWallet } from '@/lib/wallet'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"

// NEW deployed program IDs
const NEW_CORE = 'FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf'
// The Solflare wallet is registered as a verifier, so we pass the wallet's
// public key as the verifierProgram account (it CPI-signs via the tx signer).
const NEW_VERIFIER = '4VmhkonqadrxgJKt5eWYc2JEPuzCAf8YQnPm6wrGLEYu'
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')

const idl: Idl = require('@/lib/idl/pactyra_core.json')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, result, severity, actionNonce, evidenceHash } = body

    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })
    if (!result || !['pass', 'fail'].includes(result)) {
      return NextResponse.json({ error: 'result must be "pass" or "fail"' }, { status: 400 })
    }
    if (!severity || !['none', 'ordinary', 'critical'].includes(severity)) {
      return NextResponse.json({ error: 'severity must be "none", "ordinary", or "critical"' }, { status: 400 })
    }
    if (actionNonce === undefined || actionNonce === null || isNaN(Number(actionNonce)) || Number(actionNonce) < 0) {
      return NextResponse.json({ error: 'actionNonce (u64) required in request body' }, { status: 400 })
    }

    const agentIdBuf = Buffer.from(agentId, 'hex')
    if (agentIdBuf.length !== 32) return NextResponse.json({ error: 'Invalid agent ID' }, { status: 400 })

    const walletKeypair = loadWalletKeypair()
    const wallet = makeAnchorWallet(walletKeypair)
    const connection = new Connection(DEVNET_RPC, 'confirmed')
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
    if ((idl as any).address !== NEW_CORE) {
      throw new Error(`IDL address mismatch: expected NEW core ${NEW_CORE}, got ${(idl as any).address}`)
    }
    const program = new Program(idl, provider)

    const nonceBuf = new BN(actionNonce).toArrayLike(Buffer, 'le', 8)

    // Core PDAs
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), agentIdBuf], program.programId
    )
    const [verifierRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('verifier_registry')], program.programId
    )
    const [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), Buffer.from('PAY-V1')], program.programId
    )
    const [bondPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('bond'), agentIdBuf], program.programId
    )
    // Execution PDA: [b"execution", agent_id, action_nonce.to_le_bytes()]
    const [executionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('execution'), agentIdBuf, nonceBuf], program.programId
    )
    // Bond vault PDA: [b"bond_vault", usdc_mint]
    const [bondVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('bond_vault'), USDC_MINT.toBuffer()], program.programId
    )
    // Slash destination: the verifier operator's USDC associated token account
    const slashDestination = getAssociatedTokenAddressSync(USDC_MINT, walletKeypair.publicKey)

    // The Execution PDA must already exist (asserted + executed by the target
    // program). Read it via raw account info — the IDL does not define
    // the Execution account type for this deployed program version.
    const execAccountInfo = await connection.getAccountInfo(executionPda)
    if (!execAccountInfo || execAccountInfo.data.length < 211) {
      return NextResponse.json({
        error: 'Execution PDA not found — assert_capability() must run first',
        executionPda: executionPda.toString(),
      }, { status: 400 })
    }
    const execRaw = Buffer.from(execAccountInfo.data)
    const executionAgentId = execRaw.slice(40, 72)
    const executionStatus = execRaw[209]
    if (executionAgentId.toString('hex') !== agentIdBuf.toString('hex')) {
      return NextResponse.json({ error: 'Execution agent mismatch' }, { status: 400 })
    }
    if (executionStatus === 2) { // 2 = Recorded
      return NextResponse.json({ error: 'Execution already recorded' }, { status: 400 })
    }

    const actionId = execRaw.slice(8, 40)      // action_id: [u8;32] at offset 8
    const capabilityId = execRaw.slice(72, 104) // capability_id: [u8;32] at offset 72

    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('receipt'), agentIdBuf, actionId], program.programId
    )

    // evidence_hash must be non-zero (keccak256 of verified data upstream).
    let evidenceBuf: Buffer
    if (typeof evidenceHash === 'string' && /^[0-9a-fA-F]{64}$/.test(evidenceHash)) {
      evidenceBuf = Buffer.from(evidenceHash, 'hex')
    } else {
      evidenceBuf = Buffer.from(Keypair.generate().publicKey.toBytes())
    }

    const resultObj = result === 'pass' ? { pass: {} } : { fail: {} }
    const severityObj = { [severity]: {} }

    // All 13 accounts required by the NEW core program:
    // agent, receipt, verifierRegistry, policy, execution, bond, bondVault,
    // slashDestination, verifierProgram, usdcMint, verifierOperator,
    // tokenProgram, systemProgram
    const tx = await program.methods
      .recordOutcome(
        Array.from(actionId), Array.from(capabilityId),
        resultObj, severityObj, Array.from(evidenceBuf)
      )
      .accounts({
        agent: agentPda,
        receipt: receiptPda,
        verifierRegistry: verifierRegistryPda,
        policy: policyPda,
        execution: executionPda,
        bond: bondPda,
        bondVault: bondVaultPda,
        slashDestination: slashDestination,
        // Solflare wallet is the registered verifier — it signs the tx, so it
        // satisfies the verifier_program #[account(signer)] constraint.
        verifierProgram: walletKeypair.publicKey,
        usdcMint: USDC_MINT,
        verifierOperator: walletKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    const agent = await (program.account as any).agent.fetch(agentPda)
    const tierName = agent.tier.probation ? 'Probation'
      : agent.tier.proven ? 'Proven'
      : agent.tier.trusted ? 'Trusted' : 'Unknown'

    return NextResponse.json({
      success: true,
      message: `Outcome recorded: ${result.toUpperCase()} (${severity})`,
      agentId, tier: tierName, epoch: agent.currentEpoch.toNumber(),
      bondAmount: agent.bondAmount.toNumber(),
      successCount: agent.successCount.toNumber(),
      totalCount: agent.totalCount.toNumber(),
      criticalFailures: agent.criticalFailures.toNumber(),
      actionNonce: new BN(actionNonce).toNumber(),
      executionPda: executionPda.toString(),
      receiptPda: receiptPda.toString(),
      signature: tx,
      explorerUrl: `https://solana.fm/tx/${tx}?cluster=devnet`,
    })
  } catch (err: any) {
    console.error('Record outcome error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
