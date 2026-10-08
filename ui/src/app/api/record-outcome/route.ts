import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js'
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor'
import { loadWalletKeypair, makeAnchorWallet } from '@/lib/wallet'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=4196f886-5f5f-4fdb-8fae-128076aa8468'
const idl: Idl = require('@/lib/idl/pactyra_core.json')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, result, severity } = body

    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })
    if (!result || !['pass', 'fail'].includes(result)) {
      return NextResponse.json({ error: 'result must be "pass" or "fail"' }, { status: 400 })
    }
    if (!severity || !['none', 'ordinary', 'critical'].includes(severity)) {
      return NextResponse.json({ error: 'severity must be "none", "ordinary", or "critical"' }, { status: 400 })
    }

    const agentIdBuf = Buffer.from(agentId, 'hex')
    if (agentIdBuf.length !== 32) return NextResponse.json({ error: 'Invalid agent ID' }, { status: 400 })

    const walletKeypair = loadWalletKeypair()
    const wallet = makeAnchorWallet(walletKeypair)
    const connection = new Connection(DEVNET_RPC, 'confirmed')
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
    const program = new Program(idl, provider)

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

    const actionId = Keypair.generate().publicKey.toBytes()
    const capabilityId = Keypair.generate().publicKey.toBytes()
    const evidenceHash = Keypair.generate().publicKey.toBytes()

    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('receipt'), agentIdBuf, Buffer.from(actionId)], program.programId
    )

    const resultObj = result === 'pass' ? { pass: {} } : { fail: {} }
    const severityObj = { [severity]: {} }

    const tx = await program.methods
      .recordOutcome(
        Array.from(actionId), Array.from(capabilityId),
        resultObj, severityObj, Array.from(evidenceHash)
      )
      .accounts({
        agent: agentPda, receipt: receiptPda, verifierRegistry: verifierRegistryPda,
        policy: policyPda, bond: bondPda, verifierOperator: walletKeypair.publicKey,
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
      signature: tx,
      explorerUrl: `https://solana.fm/tx/${tx}?cluster=devnet`,
    })
  } catch (err: any) {
    console.error('Record outcome error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
