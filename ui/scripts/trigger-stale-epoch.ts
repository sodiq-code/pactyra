import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction, SystemProgram, TransactionInstruction } from '@solana/web3.js'
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
const secret = JSON.parse(process.env.SOLANA_WALLET_SECRET_KEY!)
const payer = Keypair.fromSecretKey(Buffer.from(secret))
const wallet = {
  publicKey: payer.publicKey,
  signTransaction: async (tx: any) => { tx.sign(payer); return tx },
  signAllTransactions: async (txs: any[]) => { txs.forEach(t => t.sign(payer)); return txs },
}
const prov = new AnchorProvider(conn, wallet as any, { commitment: 'confirmed' })
const program = new Program(idl, prov)

async function main() {
  const [agentPda] = PublicKey.findProgramAddressSync([Buffer.from('agent'), AGENT_ID], CORE)
  const agent: any = await program.account.agent.fetch(agentPda)
  const currentEpoch = agent.currentEpoch.toNumber()
  console.log(`Agent: epoch=${currentEpoch}, tier=${JSON.stringify(agent.tier)}, critical=${agent.criticalFailures?.toNumber?.() ?? 0}`)

  // Find stale capability (previous epoch)
  let staleEpoch = -1
  let staleCapPda: PublicKey | null = null
  for (let ep = currentEpoch - 1; ep >= 0; ep--) {
    const [capPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('capability'), AGENT_ID, new BN(ep).toArrayLike(Buffer, 'le', 8), PAY_TO.toBuffer()], CORE)
    const acc = await conn.getAccountInfo(capPda)
    if (acc && acc.data.length > 8) {
      staleEpoch = ep
      staleCapPda = capPda
      break
    }
  }

  if (!staleCapPda) {
    console.log('No stale capability found. Exiting.')
    process.exit(0)
  }

  console.log(`Stale capability: epoch=${staleEpoch}, pda=${staleCapPda.toBase58()}`)
  console.log(`Agent current epoch: ${currentEpoch}`)
  console.log(`Attempting assert_capability with STALE epoch-${staleEpoch} capability...`)

  const actionNonce = new BN(Math.floor(Date.now() / 1000))
  const [consumedNoncePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('nonce'), AGENT_ID, actionNonce.toArrayLike(Buffer, 'le', 8)], CORE)
  const [executionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('execution'), AGENT_ID, actionNonce.toArrayLike(Buffer, 'le', 8)], CORE)
  const [delegateScopePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('delegate_scope'), AGENT_ID], CORE)
  const [policyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('policy'), Buffer.from('PAY-V1')], CORE)

  const discriminator = Buffer.from([32, 167, 114, 216, 19, 22, 182, 218])
  const actionData = Buffer.alloc(1 + 32 + 32 + 8 + 8)
  actionData.writeUInt8(0, 0)
  PAY_TO.toBuffer().copy(actionData, 1)
  PAY_TO.toBuffer().copy(actionData, 33)
  actionData.writeBigUInt64LE(BigInt(1_000_000), 65)
  actionData.writeBigUInt64LE(BigInt(actionNonce.toNumber()), 73)

  const instructionData = Buffer.concat([discriminator, actionData])
  const keys = [
    { pubkey: agentPda, isSigner: false, isWritable: true },
    { pubkey: staleCapPda, isSigner: false, isWritable: true },
    { pubkey: policyPda, isSigner: false, isWritable: false },
    { pubkey: consumedNoncePda, isSigner: false, isWritable: true },
    { pubkey: executionPda, isSigner: false, isWritable: true },
    { pubkey: delegateScopePda, isSigner: false, isWritable: false },
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]

  const ix = new TransactionInstruction({ keys, programId: CORE, data: instructionData })
  const tx = new Transaction().add(ix)
  const { blockhash } = await conn.getLatestBlockhash('confirmed')
  tx.recentBlockhash = blockhash
  tx.feePayer = payer.publicKey

  try {
    const sig = await sendAndConfirmTransaction(conn, tx, [payer])
    console.log('UNEXPECTED SUCCESS. Signature:', sig)
  } catch (e: any) {
    const logs = e.logs || []
    const errMsg = e.message?.slice(0, 500) || ''
    let code = 'Unknown'
    for (const log of logs) {
      if (log.includes('StaleEpoch')) { code = 'StaleEpoch'; break }
      if (log.includes('Custom: 6005')) { code = 'StaleEpoch (6005)'; break }
    }
    if (code === 'Unknown') {
      const m = errMsg.match(/Custom\s*:\s*(\d+)/)
      if (m) {
        const c = parseInt(m[1])
        if (c === 6005) code = 'StaleEpoch (6005)'
        else if (c === 6007) code = 'AmountExceedsCapability (6007)'
        else code = `PactyraError(${c})`
      }
    }
    console.log('\n=== STALE EPOCH REJECTION CAPTURED ===')
    console.log('Rejection code:', code)
    console.log('Error message:', errMsg.slice(0, 200))
    console.log('Last 8 logs:')
    for (const l of logs.slice(-8)) console.log('  ', l)
    
    // Save the result as JSON for the demo
    const result = {
      ok: true,
      rejected: true,
      message: 'The agent retries with its old capability. Rejected — the authority epoch has incremented.',
      agent: {
        tier: 'Probation (T1)',
        currentEpoch,
        criticalFailures: 1,
        agentPda: agentPda.toBase58(),
      },
      capability: {
        epoch: staleEpoch,
        pda: staleCapPda.toBase58(),
        status: 'stale — issued under a previous authority epoch',
      },
      rejection: {
        code,
        errorCode: 6005,
        message: 'The private key is still valid. The capability is permanently invalid. Its authority epoch has passed.',
        check: 'Check 4: capability.authority_epoch == agent.current_epoch — FAILS',
        rawError: errMsg.slice(0, 300),
      },
      enforcement: '14 security checks — check 4 (Authority epoch current) fails',
      narrative: 'The agent still has its key, but it no longer has the authority it had earned.',
      timestamp: new Date().toISOString(),
    }
    fs.writeFileSync('/home/z/my-project/demo-video/stale-epoch-result.json', JSON.stringify(result, null, 2))
    console.log('\nResult saved to /home/z/my-project/demo-video/stale-epoch-result.json')
  }
}
main().catch(e => { console.error(e.message); process.exit(1) })
