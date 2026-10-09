import { NextResponse } from 'next/server'

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { Connection, PublicKey } from '@solana/web3.js'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"

const PROGRAMS = [
  { name: 'pactyra-core', id: 'FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf', size: 582, instructions: 21 },
  { name: 'pactyra-verifier', id: '4VmhkonqadrxgJKt5eWYc2JEPuzCAf8YQnPm6wrGLEYu', size: 299, instructions: 3 },
  { name: 'reference-treasury', id: '6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9', size: 378, instructions: 4 },
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
