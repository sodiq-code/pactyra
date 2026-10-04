import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { Connection, PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor'

const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=4196f886-5f5f-4fdb-8fae-128076aa8468'
const PACTYRA_CORE_PROGRAM_ID = 'EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC'

// Minimal IDL for fetching agent data
const idl: Idl = require('@/lib/idl/pactyra_core.json')

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentIdParam = searchParams.get('id')

    if (!agentIdParam) {
      return NextResponse.json(
        { error: 'Agent ID required as ?id=<hex>' },
        { status: 400 }
      )
    }

    const connection = new Connection(DEVNET_RPC, 'confirmed')
    const program = new Program(idl, { connection, publicKey: PublicKey.default } as any)

    // Convert hex to bytes
    const agentId = Buffer.from(agentIdParam, 'hex')
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), agentId],
      new PublicKey(PACTYRA_CORE_PROGRAM_ID)
    )

    try {
      const agent = await (program.account as any).agent.fetch(agentPda)

      const tierName = agent.tier.probation ? 'Probation'
        : agent.tier.proven ? 'Proven'
        : agent.tier.trusted ? 'Trusted' : 'Unknown'

      const maxAmount = agent.tier.probation ? 5
        : agent.tier.proven ? 50
        : agent.tier.trusted ? 500 : 0

      const successRate = agent.totalCount.toNumber() > 0
        ? (agent.successCount.toNumber() * 100) / agent.totalCount.toNumber()
        : 0

      return NextResponse.json({
        found: true,
        agentId: agentIdParam,
        agentPda: agentPda.toString(),
        authorityRoot: agent.authorityRoot.toString(),
        currentEpoch: agent.currentEpoch.toNumber(),
        tier: tierName,
        maxAmount,
        successCount: agent.successCount.toNumber(),
        totalCount: agent.totalCount.toNumber(),
        successRate: Math.round(successRate * 10) / 10,
        criticalFailures: agent.criticalFailures.toNumber(),
        bondAmount: agent.bondAmount.toNumber(),
        status: agent.status.active ? 'Active' : 'Frozen',
        rpc: 'devnet',
      })
    } catch (fetchErr: any) {
      return NextResponse.json({
        found: false,
        agentId: agentIdParam,
        agentPda: agentPda.toString(),
        message: 'Agent account not found on devnet. Either the agent ID is wrong or the account has not been created yet.',
      })
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
