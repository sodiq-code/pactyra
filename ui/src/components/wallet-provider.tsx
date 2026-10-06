'use client'

import { useMemo, type ReactNode } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import type { Adapter } from '@solana/wallet-adapter-base'

// Wallet adapter UI styles (must be imported in a client component bundle)
import '@solana/wallet-adapter-react-ui/styles.css'

// Devnet endpoint — matches the rest of the PACTYRA UI (see /api/agent route).
const ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC ||
  'https://api.devnet.solana.com'

export function WalletContextProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo<Adapter[]>(
    () => [new PhantomWalletAdapter()],
    [],
  )

  return (
    <ConnectionProvider endpoint={ENDPOINT} config={{ commitment: 'confirmed' }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

export default WalletContextProvider
