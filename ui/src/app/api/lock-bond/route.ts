import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js'
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor'
import { loadWalletKeypair, makeAnchorWallet } from '@/lib/wallet'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=4196f886-5f5f-4fdb-8fae-128076aa8468'
const idl: Idl = require('@/lib/idl/pactyra_core.json')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, amount } = body

    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 })
    }

    const agentIdBuf = Buffer.from(agentId, 'hex')
    if (agentIdBuf.length !== 32) {
      return NextResponse.json({ error: 'Invalid agent ID' }, { status: 400 })
    }

    const bondAmount = amount || 5_000_000

    const walletKeypair = loadWalletKeypair()
    const wallet = makeAnchorWallet(walletKeypair)
    const connection = new Connection(DEVNET_RPC, 'confirmed')
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
    const program = new Program(idl, provider)

    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), agentIdBuf], program.programId
    )
    const [bondPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('bond'), agentIdBuf], program.programId
    )

    const tx = await program.methods
      .lockBond(new BN(bondAmount))
      .accounts({
        agent: agentPda,
        bond: bondPda,
        authorityRoot: walletKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    const agent = await (program.account as any).agent.fetch(agentPda)

    return NextResponse.json({
      success: true,
      message: 'Bond locked',
      agentId,
      bondAmount: agent.bondAmount.toNumber(),
      signature: tx,
      explorerUrl: `https://solana.fm/tx/${tx}?cluster=devnet`,
    })
  } catch (err: any) {
    console.error('Lock bond error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
