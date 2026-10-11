import { Connection, PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor'
import * as fs from 'fs'
import * as path from 'path'

const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
const CORE = new PublicKey('FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf')
const AGENT_ID = Buffer.from('c3e081b665887dc265469a1d5906c53e1beb633dcc5651b01e76a10796e771f9', 'hex')
const PAY_TO = new PublicKey('4ZokQYezBqFkUUQVWi7axR2qT6SS3vm2Q37ZzdPwyiBN')

const conn = new Connection(RPC, 'confirmed')
const idlPath = path.join(process.cwd(), 'src/lib/idl/pactyra_core.json')
const idl: Idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'))
const wallet = { publicKey: PublicKey.unique(), signTransaction: async()=>{throw 0}, signAllTransactions: async()=>{throw 0} }
const prov = new AnchorProvider(conn, wallet as any, { commitment: 'confirmed' })
const program = new Program(idl, prov)

async function main() {
  const [agentPda] = PublicKey.findProgramAddressSync([Buffer.from('agent'), AGENT_ID], CORE)
  const agent: any = await program.account.agent.fetch(agentPda)
  const currentEpoch = agent.currentEpoch.toNumber()
  console.log('Agent current epoch:', currentEpoch)
  console.log('Agent tier:', JSON.stringify(agent.tier))
  console.log('critical_failures:', agent.criticalFailures?.toNumber?.() ?? agent.criticalFailures)

  for (let ep = currentEpoch; ep >= Math.max(0, currentEpoch - 3); ep--) {
    const [capPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('capability'), AGENT_ID, new BN(ep).toArrayLike(Buffer, 'le', 8), PAY_TO.toBuffer()], CORE)
    const acc = await conn.getAccountInfo(capPda)
    if (acc && acc.data.length > 8) {
      console.log(`Epoch ${ep}: capability EXISTS at ${capPda.toBase58()} (${acc.data.length} bytes)`)
    } else {
      console.log(`Epoch ${ep}: no capability`)
    }
  }
}
main().catch(e => { console.error(e.message); process.exit(1) })
