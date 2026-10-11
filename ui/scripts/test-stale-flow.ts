import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction, SystemProgram, TransactionInstruction } from '@solana/web3.js'
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor'
import * as fs from 'fs'
import * as path from 'path'

const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
const CORE = new PublicKey('FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf')
const AGENT_ID = Buffer.from('c3e081b665887dc265469a1d5906c53e1beb633dcc5651b01e76a10796e771f9', 'hex')
const VERIFIER = new PublicKey('4VmhkonqkUBZpvd5SVhUWqfYE8W44CzNYxJhWDhqLk7V')
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

  // Step 1: Read current state
  const agent0: any = await program.account.agent.fetch(agentPda)
  const epoch0 = agent0.currentEpoch.toNumber()
  console.log(`BEFORE: epoch=${epoch0}, tier=${JSON.stringify(agent0.tier)}, critical=${agent0.criticalFailures?.toNumber?.() ?? 0}`)

  // Step 2: Run critical failure via verifier program (record_outcome with critical=true)
  // This is complex — instead, let's check if there's already a previous-epoch capability
  // (in case the critical failure was already run during prior testing)

  // Check for capability at epoch 0
  const [capPda0] = PublicKey.findProgramAddressSync(
    [Buffer.from('capability'), AGENT_ID, new BN(0).toArrayLike(Buffer, 'le', 8), PAY_TO.toBuffer()], CORE)
  const acc0 = await conn.getAccountInfo(capPda0)

  // Check for capability at epoch 1
  const [capPda1] = PublicKey.findProgramAddressSync(
    [Buffer.from('capability'), AGENT_ID, new BN(1).toArrayLike(Buffer, 'le', 8), PAY_TO.toBuffer()], CORE)
  const acc1 = await conn.getAccountInfo(capPda1)

  console.log(`Epoch 0 cap: ${acc0 ? 'EXISTS' : 'no'} (${capPda0.toBase58()})`)
  console.log(`Epoch 1 cap: ${acc1 ? 'EXISTS' : 'no'} (${capPda1.toBase58()})`)

  if (epoch0 > 0) {
    // Try stale-epoch assertion with epoch 0 capability (if agent is at epoch > 0)
    // But agent is at epoch 1 currently — let's check if epoch 0 cap exists
    if (acc0) {
      console.log('\n=== Attempting assert_capability with STALE epoch-0 capability ===')
      console.log('Agent is at epoch', epoch0, '— capability is from epoch 0 → STALE')

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
      actionData.writeBigUInt64LE(BigInt(1_000_000), 65) // $1 USDC
      actionData.writeBigUInt64LE(BigInt(actionNonce.toNumber()), 73)

      const instructionData = Buffer.concat([discriminator, actionData])
      const keys = [
        { pubkey: agentPda, isSigner: false, isWritable: true },
        { pubkey: capPda0, isSigner: false, isWritable: true },
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
        await sendAndConfirmTransaction(conn, tx, [payer])
        console.log('UNEXPECTED: assertion succeeded (should have failed)')
      } catch (e: any) {
        const logs = e.logs || []
        const errMsg = e.message?.slice(0, 300) || ''
        console.log('REJECTION captured!')
        console.log('Error:', errMsg)
        // Check for StaleEpoch in logs
        let found = 'Unknown'
        for (const log of logs) {
          if (log.includes('StaleEpoch')) { found = 'StaleEpoch'; break }
          if (log.includes('Custom: 6005')) { found = 'StaleEpoch (6005)'; break }
        }
        if (!found.includes('StaleEpoch')) {
          const m = errMsg.match(/Custom\s*:\s*(\d+)/)
          if (m && m[1] === '6005') found = 'StaleEpoch (6005)'
        }
        console.log('Rejection code:', found)
        console.log('Last 5 logs:')
        for (const l of logs.slice(-5)) console.log('  ', l)
      }
    } else {
      console.log('\nNo epoch-0 capability exists. Need to run critical failure first.')
      console.log('To test StaleEpoch: run verifier/demo?force=critical → epoch increments → epoch-0 cap becomes stale')
    }
  } else {
    console.log('\nAgent is at epoch 0 — no previous epoch capability possible.')
  }

  // Final state
  const agentF: any = await program.account.agent.fetch(agentPda)
  console.log(`\nAFTER: epoch=${agentF.currentEpoch.toNumber()}, tier=${JSON.stringify(agentF.tier)}`)
}
main().catch(e => { console.error(e.message); process.exit(1) })
