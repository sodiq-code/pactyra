import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor'
import { loadWalletKeypair, makeAnchorWallet } from '@/lib/wallet'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
const PACTYRA_CORE_PROGRAM_ID = 'EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC'
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
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
    const coreProgramId = new PublicKey(PACTYRA_CORE_PROGRAM_ID)

    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), agentIdBuf], coreProgramId
    )
    const [bondPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('bond'), agentIdBuf], coreProgramId
    )
    const [bondVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('bond_vault'), USDC_MINT.toBuffer()], coreProgramId
    )
    const agentToken = await getAssociatedTokenAddress(USDC_MINT, walletKeypair.publicKey)

    const tx = await program.methods
      .lockBond(new BN(bondAmount))
      .accounts({
        agent: agentPda,
        bond: bondPda,
        agentToken,
        bondVault,
        usdcMint: USDC_MINT,
        authorityRoot: walletKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
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
