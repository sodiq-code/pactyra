import { Keypair } from '@solana/web3.js'

/**
 * Load the server-side Solana wallet keypair.
 * 
 * On local: reads from ~/.config/solana/id.json
 * On Vercel: reads from SOLANA_WALLET_SECRET_KEY env var (JSON array string)
 */
export function loadWalletKeypair(): Keypair {
  // Try environment variable first (Vercel)
  if (process.env.SOLANA_WALLET_SECRET_KEY) {
    try {
      const secretKey = JSON.parse(process.env.SOLANA_WALLET_SECRET_KEY)
      return Keypair.fromSecretKey(Buffer.from(secretKey))
    } catch (e) {
      console.error('Failed to parse SOLANA_WALLET_SECRET_KEY:', e)
    }
  }

  // Fall back to file (local dev)
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

  throw new Error(
    'No wallet available. Set SOLANA_WALLET_SECRET_KEY env var or create ~/.config/solana/id.json'
  )
}

/**
 * Simple wallet implementation for Anchor (Wallet class not exported in 0.32)
 */
export function makeAnchorWallet(keypair: Keypair) {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx: any) => { tx.sign(keypair); return tx },
    signAllTransactions: async (txs: any[]) => { 
      txs.forEach((tx: any) => tx.sign(keypair)); 
      return txs 
    },
  }
}
