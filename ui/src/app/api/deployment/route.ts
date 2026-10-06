import { NextResponse } from 'next/server'

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { Connection, PublicKey } from '@solana/web3.js'

const DEVNET_RPC = 'process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"'

const PROGRAMS = [
  { name: 'pactyra-core', id: 'EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC', size: 418, instructions: 20 },
  { name: 'pactyra-verifier', id: '5dK7xXDUSHDcP8qFxrLLFo4Nm2Xzn7rSKgDMmrFFLZsN', size: 217, instructions: 3 },
  { name: 'reference-treasury', id: '6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9', size: 288, instructions: 4 },
  { name: 'threshold-multisig', id: 'FgfW1JkSknJpcCypbhuv531qvVu2z8sNVPH2kZXLpDKc', size: 221, instructions: 7 },
]

export async function GET() {
  try {
    const connection = new Connection(DEVNET_RPC, 'confirmed')

    const results = await Promise.all(
      PROGRAMS.map(async (p) => {
        try {
          const info = await connection.getAccountInfo(new PublicKey(p.id))
          return {
            ...p,
            deployed: info !== null,
            owner: info?.owner.toString() || null,
            lamports: info?.lamports || 0,
            dataLength: info?.data.length || 0,
            executable: info?.executable || false,
          }
        } catch {
          return { ...p, deployed: false, owner: null, lamports: 0, dataLength: 0, executable: false }
        }
      })
    )

    const wallet = 'A55wG1G5nLVxn9Ns91ogrqZ6cHVi2yPd7WRi8GCyc3PE'
    const balance = await connection.getBalance(new PublicKey(wallet))

    return NextResponse.json({
      rpc: DEVNET_RPC,
      cluster: 'devnet',
      wallet,
      balanceSOL: balance / 1e9,
      programs: results,
      allDeployed: results.every((p) => p.deployed),
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
