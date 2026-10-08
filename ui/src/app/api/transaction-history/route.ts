import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { Connection, PublicKey } from '@solana/web3.js'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentIdParam = searchParams.get('id')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!agentIdParam) {
      return NextResponse.json({ error: 'Agent ID required as ?id=<hex>' }, { status: 400 })
    }

    const connection = new Connection(DEVNET_RPC, 'confirmed')

    // Get the agent PDA
    const agentIdBuf = Buffer.from(agentIdParam, 'hex')
    if (agentIdBuf.length !== 32) {
      return NextResponse.json({ error: 'Invalid agent ID' }, { status: 400 })
    }

    const PACTYRA_CORE_PROGRAM_ID = 'EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC'
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), agentIdBuf],
      new PublicKey(PACTYRA_CORE_PROGRAM_ID)
    )

    // Get transaction signatures for the agent PDA
    const signatures = await connection.getSignaturesForAddress(agentPda, { limit })

    const transactions = await Promise.all(
      signatures.map(async (sig) => {
        const tx = await connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        })
        return {
          signature: sig.signature,
          slot: sig.slot,
          blockTime: sig.blockTime,
          err: sig.err,
          memo: sig.memo,
          explorerUrl: `https://solana.fm/tx/${sig.signature}?cluster=devnet`,
          instruction: tx?.transaction?.message?.instructions?.[0]?.data
            ? Buffer.from(tx.transaction.message.instructions[0].data, 'base64').toString('hex').substring(0, 16)
            : null,
        }
      })
    )

    return NextResponse.json({
      agentId: agentIdParam,
      agentPda: agentPda.toString(),
      count: transactions.length,
      transactions,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
