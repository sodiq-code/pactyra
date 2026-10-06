/**
 * PACTYRA x402 V2 Adapter
 *
 * Real x402 HTTP payment protocol integration with PACTYRA capability gating.
 * No simulated signatures — every payment is a real on-chain USDC transfer.
 *
 * Flow:
 *   1. Agent makes HTTP request to an x402-enabled service
 *   2. Service returns 402 Payment Required with x402 requirements
 *   3. Adapter checks PACTYRA assert_capability (13 security checks)
 *   4. If capability passes, adapter creates a real SPL token transfer
 *   5. Transaction is signed and submitted to Solana
 *   6. Real transaction signature is sent as X-PAYMENT header
 *   7. Service verifies the payment on-chain and returns the resource
 *
 * x402 V2 headers:
 *   - WWW-Authenticate: x402 (server → client, 402 response)
 *   - X-PAYMENT: <transaction-signature> (client → server, payment proof)
 *   - X-PAYMENT-RESPONSE: <base64-encoded-receipt> (server → client, verified)
 *
 * Usage:
 *   import { PactyraX402Adapter } from '@pactyra/client/adapters/x402';
 *
 *   const adapter = new PactyraX402Adapter({
 *     pactyraClient,
 *     agentId,
 *     capabilityPda,
 *     rpcUrl: 'https://api.devnet.solana.com',
 *     usdcMint: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
 *     payerTokenAccount,  // agent's USDC token account
 *     payerKeypair,       // agent's signing keypair
 *   });
 *
 *   const result = await adapter.fetch('https://service.example.com/api', {
 *     method: 'GET',
 *     maxAmount: 5_000_000,
 *     actionNonce: 42,
 *   });
 */

import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import {
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token'
import type { PactyraClient } from '../client'

// ============================================================
// x402 V2 Types
// ============================================================

export interface X402PaymentRequirement {
  scheme: string         // 'exact' for exact-amount payments
  network: string         // 'solana-devnet' or 'solana'
  asset: string           // USDC mint address
  maxTotalAmount: {
    value: string          // amount in base units (e.g. "10000" for 0.01 USDC)
    currency: string       // 'USDC'
  }
  resource: string         // URL of the resource being purchased
  payTo: string            // recipient wallet address
  maxTimeoutSeconds: number
  description?: string
}

export interface X402PaymentResponse {
  x402Version: number
  requires: X402PaymentRequirement[]
  error?: string
}

export interface X402PaymentReceipt {
  signature: string
  amount: number
  currency: string
  slot?: number
}

export interface PactyraX402AdapterConfig {
  pactyraClient: PactyraClient
  agentId: Uint8Array
  capabilityPda: PublicKey
  rpcUrl: string
  usdcMint: PublicKey
  payerTokenAccount: PublicKey   // agent's USDC token account (source)
  payerKeypair: Keypair          // agent's signing keypair
}

export interface X402FetchOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
  maxAmount: number        // max USDC base units the agent is willing to pay
  actionNonce: number       // PACTYRA action nonce for replay protection
}

export interface X402FetchResult {
  status: number
  ok: boolean
  data: any
  paymentMade: boolean
  capabilityAsserted: boolean
  signature?: string        // real Solana transaction signature
  receipt?: X402PaymentReceipt
}

// ============================================================
// PACTYRA x402 V2 Adapter
// ============================================================

export class PactyraX402Adapter {
  private client: PactyraClient
  private agentId: Uint8Array
  private capabilityPda: PublicKey
  private connection: Connection
  private usdcMint: PublicKey
  private payerTokenAccount: PublicKey
  private payerKeypair: Keypair

  constructor(config: PactyraX402AdapterConfig) {
    this.client = config.pactyraClient
    this.agentId = config.agentId
    this.capabilityPda = config.capabilityPda
    this.connection = new Connection(config.rpcUrl, 'confirmed')
    this.usdcMint = config.usdcMint
    this.payerTokenAccount = config.payerTokenAccount
    this.payerKeypair = config.payerKeypair
  }

  /**
   * Make a paid HTTP request gated by PACTYRA capability.
   *
   * 1. Fetch the resource — if 402, extract payment requirements
   * 2. Assert PACTYRA capability — verify the agent has earned the right to pay
   * 3. Create and submit a real SPL token transfer on Solana
   * 4. Retry the request with the real transaction signature as X-PAYMENT
   * 5. Return the resource + payment receipt
   */
  async fetch(
    url: string,
    options: X402FetchOptions
  ): Promise<X402FetchResult> {
    const { method = 'GET', headers = {}, body, maxAmount, actionNonce } = options

    // Step 1: Initial request — expect 402 if payment is required
    const initialResponse = await fetch(url, { method, headers, body })
    const status = initialResponse.status

    // If not 402, return the response directly (no payment needed)
    if (status !== 402) {
      const data = await this.parseResponse(initialResponse)
      return {
        status,
        ok: initialResponse.ok,
        data,
        paymentMade: false,
        capabilityAsserted: false,
      }
    }

    // Step 2: Parse 402 payment requirements
    const paymentData: X402PaymentResponse = await initialResponse.json()
    const requirement = paymentData.requires?.[0]

    if (!requirement) {
      return {
        status: 402,
        ok: false,
        data: { error: 'No payment requirements in 402 response' },
        paymentMade: false,
        capabilityAsserted: false,
      }
    }

    // Verify the payment amount is within the agent's willingness to pay
    const requiredAmount = parseInt(requirement.maxTotalAmount.value)
    if (requiredAmount > maxAmount) {
      return {
        status: 402,
        ok: false,
        data: {
          error: 'AmountExceedsCapability',
          message: `Required ${requiredAmount} but max allowed is ${maxAmount}`,
        },
        paymentMade: false,
        capabilityAsserted: false,
      }
    }

    // Step 3: Assert PACTYRA capability BEFORE paying
    // This is the key integration: the agent must have earned the right to pay
    try {
      const targetProgram = new PublicKey(requirement.resource || url)
      const targetAccount = new PublicKey(requirement.payTo)

      await this.client.assertCapability(this.agentId, {
        actionType: 'payService' as any,
        targetProgram: targetProgram.toString(),
        targetAccount: targetAccount.toString(),
        amount: requiredAmount,
        actionNonce,
      })
    } catch (err: any) {
      return {
        status: 402,
        ok: false,
        data: {
          error: 'CapabilityAssertionFailed',
          message: err.message || 'assert_capability rejected the action',
        },
        paymentMade: false,
        capabilityAsserted: false,
      }
    }

    // Step 4: Capability is valid — make the REAL USDC payment
    const payTo = new PublicKey(requirement.payTo)
    const signature = await this.facilitatePayment(
      requiredAmount,
      payTo
    )

    if (!signature) {
      return {
        status: 402,
        ok: false,
        data: { error: 'PaymentFailed', message: 'USDC transfer failed' },
        paymentMade: false,
        capabilityAsserted: true,
      }
    }

    // Step 5: Retry the request with the REAL payment signature
    const paidResponse = await fetch(url, {
      method,
      headers: {
        ...headers,
        'X-PAYMENT': signature,
        'X-PAYMENT-NETWORK': requirement.network || 'solana-devnet',
      },
      body,
    })

    const paidData = await this.parseResponse(paidResponse)

    // Extract payment receipt from response header
    const receiptHeader = paidResponse.headers.get('x-payment-response')
    let receipt: X402PaymentReceipt | undefined
    if (receiptHeader) {
      try {
        receipt = JSON.parse(Buffer.from(receiptHeader, 'base64').toString())
        receipt.signature = signature
      } catch {
        receipt = { signature, amount: requiredAmount, currency: 'USDC' }
      }
    } else {
      receipt = { signature, amount: requiredAmount, currency: 'USDC' }
    }

    return {
      status: paidResponse.status,
      ok: paidResponse.ok,
      data: paidData,
      paymentMade: true,
      capabilityAsserted: true,
      signature,
      receipt,
    }
  }

  /**
   * Facilitate a REAL USDC payment via SPL token transfer.
   *
   * Creates a Solana transaction that transfers USDC from the agent's
   * token account to the payee's token account, signs it with the
   * agent's keypair, and submits it to the network.
   *
   * Returns the real transaction signature, or null on failure.
   */
  private async facilitatePayment(
    amount: number,
    payTo: PublicKey
  ): Promise<string | null> {
    try {
      // Get or create the payee's associated token account for USDC
      const payeeTokenAccount = await getAssociatedTokenAddress(
        this.usdcMint,
        payTo,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )

      // Check if the payee's token account exists
      const payeeAccountInfo = await this.connection.getAccountInfo(payeeTokenAccount)

      const transaction = new Transaction()

      // If payee doesn't have a token account, we need to create one
      if (!payeeAccountInfo) {
        const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token')
        transaction.add(
          createAssociatedTokenAccountInstruction(
            this.payerKeypair.publicKey,  // payer
            payeeTokenAccount,             // new account
            payTo,                         // owner
            this.usdcMint,                 // mint
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        )
      }

      // Add the USDC transfer instruction
      transaction.add(
        createTransferInstruction(
          this.payerTokenAccount,  // source
          payeeTokenAccount,       // destination
          this.payerKeypair.publicKey,  // owner (authority)
          amount,                  // amount in base units
          [],                      // multisig signers (none)
          TOKEN_PROGRAM_ID
        )
      )

      // Get latest blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed')
      transaction.recentBlockhash = blockhash
      transaction.feePayer = this.payerKeypair.publicKey

      // Sign and submit the transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.payerKeypair]
      )

      return signature
    } catch (err: any) {
      console.error('x402 payment failed:', err)
      return null
    }
  }

  /**
   * Parse an HTTP response as JSON or text.
   */
  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return response.json()
    }
    return response.text()
  }

  /**
   * Check if a capability is valid for a given amount without making a payment.
   * Useful for pre-flight checks before attempting a paid request.
   */
  async checkCapability(amount: number): Promise<boolean> {
    try {
      const agent = await this.client.getAgent(this.agentId)
      const tierMax = this.client.getTierMaxAmount(agent.tier)
      return amount <= tierMax
    } catch {
      return false
    }
  }

  /**
   * Get the agent's current authority tier and max capability amount.
   */
  async getAuthorityInfo(): Promise<{ tier: string; maxAmount: number }> {
    const agent = await this.client.getAgent(this.agentId)
    return {
      tier: this.client.getTierName(agent.tier),
      maxAmount: this.client.getTierMaxAmount(agent.tier),
    }
  }
}
