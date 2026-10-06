/**
 * x402 V2 Real Integration Demo
 *
 * Tests the complete x402 payment flow with REAL on-chain USDC transfers:
 *
 * 1. Fetches the agent's state from devnet
 * 2. Makes a request to the x402-enabled resource endpoint
 * 3. Gets a 402 Payment Required response
 * 4. Verifies the agent has PACTYRA capability (capability check)
 * 5. Creates and submits a REAL SPL token transfer on Solana devnet
 * 6. Retries the request with the REAL transaction signature
 * 7. Server verifies the payment on-chain and returns the resource
 *
 * No simulated signatures. Every payment is a real on-chain transaction.
 *
 * Run: npx ts-node --transpile-only scripts/x402-demo.ts
 */

import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import {
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token'
import { Transaction, sendAndConfirmTransaction } from '@solana/web3.js'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')
const PERMANENT_AGENT = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
const RESOURCE_URL = process.env.X402_RESOURCE_URL || 'http://localhost:3000/api/x402/resource'
const PAYMENT_AMOUNT = 10_000 // 0.01 USDC

// Load the payer keypair from env var or file
function loadKeypair(): Keypair {
  if (process.env.SOLANA_WALLET_SECRET_KEY) {
    try {
      const secretKey = JSON.parse(process.env.SOLANA_WALLET_SECRET_KEY)
      return Keypair.fromSecretKey(Buffer.from(secretKey))
    } catch (e) {
      console.error('Failed to parse SOLANA_WALLET_SECRET_KEY')
    }
  }
  // Fall back to file
  const fs = require('fs')
  const path = require('path')
  const walletPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '/home/z',
    '.config/solana/id.json'
  )
  if (fs.existsSync(walletPath)) {
    const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'))
    return Keypair.fromSecretKey(Buffer.from(keypairData))
  }
  throw new Error('No wallet available. Set SOLANA_WALLET_SECRET_KEY or create ~/.config/solana/id.json')
}

async function main() {
  console.log('=== PACTYRA x402 V2 Real Integration Demo ===\n')

  console.log('This demo performs REAL on-chain USDC transfers on Solana devnet.')
  console.log('No simulated signatures.\n')

  const connection = new Connection(DEVNET_RPC, 'confirmed')
  const payer = loadKeypair()

  console.log(`Payer: ${payer.publicKey.toString()}`)
  console.log(`RPC: ${DEVNET_RPC}`)
  console.log(`USDC Mint: ${USDC_MINT.toString()}`)
  console.log(`Resource: ${RESOURCE_URL}`)
  console.log(`Payment: ${PAYMENT_AMOUNT / 1_000_000} USDC (${PAYMENT_AMOUNT} base units)`)
  console.log('')

  // Step 1: Check agent state on devnet
  console.log('Step 1: Checking agent state on devnet...')
  const agentResponse = await fetch(
    `https://pactyra-ui.vercel.app/api/agent?id=${PERMANENT_AGENT}`
  )
  const agentData = await agentResponse.json()

  if (!agentData.found) {
    console.log('✗ Agent not found on devnet')
    return
  }

  console.log(`  ✓ Agent found: tier=${agentData.tier}, status=${agentData.status}`)
  console.log(`  ✓ Bond: ${agentData.bondAmount / 1_000_000} USDC`)
  console.log(`  ✓ Success: ${agentData.successCount}/${agentData.totalCount}`)
  console.log('')

  // Step 2: Make initial request — expect 402
  console.log('Step 2: Making initial request to x402 resource...')
  const initialResponse = await fetch(RESOURCE_URL)
  console.log(`  HTTP ${initialResponse.status}`)

  if (initialResponse.status !== 402) {
    console.log('  ✗ Expected 402, got', initialResponse.status)
    return
  }

  const paymentReq = await initialResponse.json()
  const requirement = paymentReq.requires?.[0]

  if (!requirement) {
    console.log('  ✗ No payment requirements in 402 response')
    return
  }

  console.log(`  ✓ 402 Payment Required`)
  console.log(`  ✓ Scheme: ${requirement.scheme}`)
  console.log(`  ✓ Network: ${requirement.network}`)
  console.log(`  ✓ Pay to: ${requirement.payTo}`)
  console.log(`  ✓ Amount: ${parseInt(requirement.maxTotalAmount.value) / 1_000_000} USDC`)
  console.log('')

  // Step 3: PACTYRA capability check
  console.log('Step 3: PACTYRA capability check...')
  const tierMax = agentData.tier === 'Probation' ? 5_000_000
    : agentData.tier === 'Proven' ? 50_000_000
    : 500_000_000

  if (parseInt(requirement.maxTotalAmount.value) > tierMax) {
    console.log(`  ✗ Amount exceeds tier max (${tierMax / 1_000_000} USDC)`)
    console.log('  → assert_capability would FAIL: AmountExceedsCapability')
    console.log('  → Payment NOT made')
    return
  }

  console.log(`  ✓ Tier ${agentData.tier} allows up to $${tierMax / 1_000_000}`)
  console.log(`  ✓ Required $${parseInt(requirement.maxTotalAmount.value) / 1_000_000} ≤ $${tierMax / 1_000_000}`)
  console.log(`  ✓ assert_capability would PASS`)
  console.log('')

  // Step 4: Make the REAL USDC payment
  console.log('Step 4: Making REAL USDC payment on Solana devnet...')
  const payTo = new PublicKey(requirement.payTo)
  const amount = parseInt(requirement.maxTotalAmount.value)

  // Get the payer's USDC token account
  const payerTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT,
    payer.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  // Get or create the payee's token account
  const payeeTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT,
    payTo,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  const transaction = new Transaction()

  // Check if payee token account exists, create if not
  const payeeAccountInfo = await connection.getAccountInfo(payeeTokenAccount)
  if (!payeeAccountInfo) {
    console.log('  → Creating payee token account...')
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        payeeTokenAccount,
        payTo,
        USDC_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )
  }

  // Add the USDC transfer instruction
  transaction.add(
    createTransferInstruction(
      payerTokenAccount,
      payeeTokenAccount,
      payer.publicKey,
      amount,
      [],
      TOKEN_PROGRAM_ID
    )
  )

  // Get blockhash and sign
  const { blockhash } = await connection.getLatestBlockhash('confirmed')
  transaction.recentBlockhash = blockhash
  transaction.feePayer = payer.publicKey

  console.log('  → Submitting transaction to Solana devnet...')
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer]
  )

  console.log(`  ✓ Payment submitted!`)
  console.log(`  ✓ Signature: ${signature}`)
  console.log(`  ✓ View: https://solana.fm/tx/${signature}?cluster=devnet`)
  console.log('')

  // Step 5: Retry request with payment proof
  console.log('Step 5: Retrying request with X-PAYMENT header...')
  const paidResponse = await fetch(RESOURCE_URL, {
    headers: {
      'X-PAYMENT': signature,
      'X-PAYMENT-NETWORK': requirement.network,
    },
  })

  console.log(`  HTTP ${paidResponse.status}`)

  if (paidResponse.status === 200) {
    const data = await paidResponse.json()
    console.log('  ✓ Payment verified on-chain!')
    console.log(`  ✓ Resource: ${data.data?.resource || 'unknown'}`)
    console.log(`  ✓ Verified amount: ${data.data?.paymentVerified?.amount / 1_000_000} USDC`)
    console.log('')

    // Check for X-PAYMENT-RESPONSE header
    const receiptHeader = paidResponse.headers.get('x-payment-response')
    if (receiptHeader) {
      const receipt = JSON.parse(Buffer.from(receiptHeader, 'base64').toString())
      console.log(`  ✓ X-PAYMENT-RESPONSE received`)
      console.log(`  ✓ Receipt signature: ${receipt.signature}`)
      console.log(`  ✓ Receipt amount: ${receipt.amount / 1_000_000} USDC`)
    }

    console.log('')
    console.log('=== x402 V2 Flow Complete ===')
    console.log('')
    console.log('  Agent → HTTP GET /api/x402/resource')
    console.log('         ← 402 Payment Required (x402 V2)')
    console.log('  PACTYRA → assert_capability() → PASS')
    console.log('  Adapter → REAL SPL token transfer (USDC)')
    console.log('         ← REAL transaction signature')
    console.log('  Agent → HTTP GET + X-PAYMENT: <real-sig>')
    console.log('  Facilitator → Verify on-chain → 200 OK')
    console.log('')
    console.log('  ✓ REAL payment. REAL signature. REAL verification.')
    console.log('  ✓ No simulated signatures anywhere in the flow.')
  } else {
    const error = await paidResponse.json()
    console.log(`  ✗ Payment verification failed: ${error.error || 'unknown'}`)
    console.log(`  Details: ${JSON.stringify(error, null, 2)}`)
  }
}

main().catch(console.error)
