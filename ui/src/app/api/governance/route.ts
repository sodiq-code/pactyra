import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js'
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor'
import { loadWalletKeypair, makeAnchorWallet } from '@/lib/wallet'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEVNET_RPC = 'process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"'
const idl: Idl = require('@/lib/idl/pactyra_core.json')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, agentId, delegate, maxAmount, expiresIn, verifierIndex, newAuthority } = body

    if (!action) {
      return NextResponse.json({ error: 'action required (delegate, freeze, unfreeze, supersede, deprecate, replace_authority, close_receipt)' }, { status: 400 })
    }

    const walletKeypair = loadWalletKeypair()
    const wallet = makeAnchorWallet(walletKeypair)
    const connection = new Connection(DEVNET_RPC, 'confirmed')
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
    const program = new Program(idl, provider)

    let tx: string = ''

    switch (action) {
      case 'delegate': {
        if (!agentId || !delegate || !maxAmount) {
          return NextResponse.json({ error: 'agentId, delegate, maxAmount required' }, { status: 400 })
        }
        const agentIdBuf = Buffer.from(agentId, 'hex')
        const [agentPda] = PublicKey.findProgramAddressSync([Buffer.from('agent'), agentIdBuf], program.programId)
        const [delegateScopePda] = PublicKey.findProgramAddressSync([Buffer.from('delegate_scope'), agentIdBuf], program.programId)
        tx = await program.methods
          .delegateAuthority(new PublicKey(delegate), new BN(maxAmount), new BN(expiresIn || 3600))
          .accounts({ agent: agentPda, delegateScope: delegateScopePda, authorityRoot: walletKeypair.publicKey, systemProgram: SystemProgram.programId })
          .rpc()
        break
      }
      case 'revoke_delegate': {
        if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })
        const agentIdBuf = Buffer.from(agentId, 'hex')
        const [agentPda] = PublicKey.findProgramAddressSync([Buffer.from('agent'), agentIdBuf], program.programId)
        const [delegateScopePda] = PublicKey.findProgramAddressSync([Buffer.from('delegate_scope'), agentIdBuf], program.programId)
        tx = await program.methods
          .revokeDelegate()
          .accounts({ agent: agentPda, delegateScope: delegateScopePda, authorityRoot: walletKeypair.publicKey })
          .rpc()
        break
      }
      case 'freeze': {
        if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })
        const agentIdBuf = Buffer.from(agentId, 'hex')
        const [agentPda] = PublicKey.findProgramAddressSync([Buffer.from('agent'), agentIdBuf], program.programId)
        tx = await program.methods
          .freezeAgent()
          .accounts({ agent: agentPda, authorityRoot: walletKeypair.publicKey })
          .rpc()
        break
      }
      case 'unfreeze': {
        if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })
        const agentIdBuf = Buffer.from(agentId, 'hex')
        const [agentPda] = PublicKey.findProgramAddressSync([Buffer.from('agent'), agentIdBuf], program.programId)
        tx = await program.methods
          .unfreezeAgent()
          .accounts({ agent: agentPda, authorityRoot: walletKeypair.publicKey })
          .rpc()
        break
      }
      case 'supersede': {
        if (!body.oldVersionTag || !body.newVersionTag) {
          return NextResponse.json({ error: 'oldVersionTag and newVersionTag required' }, { status: 400 })
        }
        const [oldPolicyPda] = PublicKey.findProgramAddressSync([Buffer.from('policy'), Buffer.from(body.oldVersionTag)], program.programId)
        const [newPolicyPda] = PublicKey.findProgramAddressSync([Buffer.from('policy'), Buffer.from(body.newVersionTag)], program.programId)
        tx = await program.methods
          .supersedePolicy()
          .accounts({ oldPolicy: oldPolicyPda, newPolicy: newPolicyPda, authority: walletKeypair.publicKey })
          .rpc()
        break
      }
      case 'deprecate': {
        if (verifierIndex === undefined) return NextResponse.json({ error: 'verifierIndex required' }, { status: 400 })
        const [verifierRegistryPda] = PublicKey.findProgramAddressSync([Buffer.from('verifier_registry')], program.programId)
        tx = await program.methods
          .deprecateVerifier(verifierIndex)
          .accounts({ verifierRegistry: verifierRegistryPda, authority: walletKeypair.publicKey })
          .rpc()
        break
      }
      case 'replace_authority': {
        if (!newAuthority) return NextResponse.json({ error: 'newAuthority required' }, { status: 400 })
        const [verifierRegistryPda] = PublicKey.findProgramAddressSync([Buffer.from('verifier_registry')], program.programId)
        tx = await program.methods
          .replaceProtocolAuthority(new PublicKey(newAuthority))
          .accounts({ verifierRegistry: verifierRegistryPda, authority: walletKeypair.publicKey })
          .rpc()
        break
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      action,
      signature: tx,
      explorerUrl: `https://solana.fm/tx/${tx}?cluster=devnet`,
    })
  } catch (err: any) {
    console.error('Governance error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
