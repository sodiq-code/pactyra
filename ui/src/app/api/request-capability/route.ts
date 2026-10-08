import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js'
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor'
import { loadWalletKeypair, makeAnchorWallet } from '@/lib/wallet'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
const idl: Idl = require('@/lib/idl/pactyra_core.json')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, amountLimit } = body

    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

    const agentIdBuf = Buffer.from(agentId, 'hex')
    if (agentIdBuf.length !== 32) return NextResponse.json({ error: 'Invalid agent ID' }, { status: 400 })

    const limit = amountLimit || 5_000_000

    const walletKeypair = loadWalletKeypair()
    const wallet = makeAnchorWallet(walletKeypair)
    const connection = new Connection(DEVNET_RPC, 'confirmed')
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
    const program = new Program(idl, provider)

    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), agentIdBuf], program.programId
    )
    const [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), Buffer.from('PAY-V1')], program.programId
    )

    const targetProgram = new PublicKey('6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9')
    const targetAccount = Keypair.generate().publicKey

    const agent = await (program.account as any).agent.fetch(agentPda)
    const epoch = agent.currentEpoch

    const [capabilityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('capability'), agentIdBuf, epoch.toArrayLike(Buffer, 'le', 8), targetProgram.toBuffer()],
      program.programId
    )

    const tx = await program.methods
      .requestCapability({
        capabilityType: { payService: {} },
        targetProgram, targetAccount,
        amountLimit: new BN(limit),
        frequencyLimit: new BN(10),
        ttlSeconds: new BN(3600),
      })
      .accounts({
        agent: agentPda, policy: policyPda, capability: capabilityPda,
        authorityRoot: walletKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    return NextResponse.json({
      success: true,
      message: 'Capability requested',
      agentId, capabilityPda: capabilityPda.toString(),
      amountLimit: limit,
      targetProgram: targetProgram.toString(),
      targetAccount: targetAccount.toString(),
      epoch: epoch.toNumber(),
      signature: tx,
      explorerUrl: `https://solana.fm/tx/${tx}?cluster=devnet`,
    })
  } catch (err: any) {
    console.error('Request capability error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
