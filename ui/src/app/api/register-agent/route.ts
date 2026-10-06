import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js'
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor'
import { loadWalletKeypair, makeAnchorWallet } from '@/lib/wallet'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEVNET_RPC = 'process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"'
const PACTYRA_CORE_PROGRAM_ID = 'EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC'
const idl: Idl = require('@/lib/idl/pactyra_core.json')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId } = body

    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json({ error: 'agentId (hex string) required' }, { status: 400 })
    }

    let agentIdBuf: Buffer
    try {
      agentIdBuf = Buffer.from(agentId, 'hex')
      if (agentIdBuf.length !== 32) throw new Error('must be 32 bytes')
    } catch {
      return NextResponse.json({ error: 'Invalid agent ID. Must be 64-char hex string (32 bytes).' }, { status: 400 })
    }

    const walletKeypair = loadWalletKeypair()
    const wallet = makeAnchorWallet(walletKeypair)

    const connection = new Connection(DEVNET_RPC, 'confirmed')
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
    const program = new Program(idl, provider)

    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), agentIdBuf],
      new PublicKey(PACTYRA_CORE_PROGRAM_ID)
    )

    const existingAccount = await connection.getAccountInfo(agentPda)
    if (existingAccount && existingAccount.data.length > 0) {
      const agent = await (program.account as any).agent.fetch(agentPda)
      const tierName = agent.tier.probation ? 'Probation'
        : agent.tier.proven ? 'Proven'
        : agent.tier.trusted ? 'Trusted' : 'Unknown'

      return NextResponse.json({
        success: true,
        message: 'Agent already registered',
        agentId,
        agentPda: agentPda.toString(),
        tier: tierName,
        epoch: agent.currentEpoch.toNumber(),
        bondAmount: agent.bondAmount.toNumber(),
        successCount: agent.successCount.toNumber(),
        totalCount: agent.totalCount.toNumber(),
        authorityRoot: agent.authorityRoot.toString(),
      })
    }

    const tx = await program.methods
      .registerAgent(Array.from(agentIdBuf))
      .accounts({
        agent: agentPda,
        authority: walletKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    const agent = await (program.account as any).agent.fetch(agentPda)

    return NextResponse.json({
      success: true,
      message: 'Agent registered on devnet',
      agentId,
      agentPda: agentPda.toString(),
      tier: 'Probation',
      epoch: agent.currentEpoch.toNumber(),
      bondAmount: agent.bondAmount.toNumber(),
      successCount: 0,
      totalCount: 0,
      authorityRoot: agent.authorityRoot.toString(),
      signature: tx,
      explorerUrl: `https://solana.fm/tx/${tx}?cluster=devnet`,
    })
  } catch (err: any) {
    console.error('Register agent error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
