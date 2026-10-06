/**
 * PACTYRA x402 Reference Adapter
 *
 * Reference implementation showing how PACTYRA capabilities can gate
 * x402 agentic payments. The payment facilitation is simulated —
 * production use requires a real x402 V2 facilitator integration.
 *
 * Flow:
 *   1. Agent makes HTTP request to an x402-enabled service
 *   2. Service returns 402 Payment Required with payment requirements
 *   3. Adapter checks PACTYRA capability (assert_capability)
 *   4. If capability is valid, adapter facilitates the USDC payment
 *   5. Service returns the resource
 *
 * This demonstrates: PACTYRA can gate agentic payments with earned authority.
 *
 * Usage:
 *   import { PactyraX402Adapter } from '@pactyra/client/adapters/x402';
 *
 *   const adapter = new PactyraX402Adapter({
 *     pactyraClient,
 *     agentId,
 *     capabilityPda,
 *     rpcUrl: 'https://api.devnet.solana.com',
 *   });
 *
 *   // Make a paid request — capability is checked before payment
 *   const response = await adapter.fetch('https://service.example.com/api', {
 *     method: 'GET',
 *     maxAmount: 5_000_000, // $5 USDC — must be within capability limit
 *   });
 */

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import type { PactyraClient } from '../client';

export interface X402PaymentRequirement {
  scheme: string;
  network: string;
  maxTotalAmount: { value: string; currency: string };
  resource: string;
  payTo: string;
  maxTimeoutSeconds: number;
  meterMax: { value: string; type: string };
  description?: string;
}

export interface X402PaymentResponse {
  x402Version: number;
  requires: X402PaymentRequirement[];
  error?: string;
}

export interface PactyraX402AdapterConfig {
  pactyraClient: PactyraClient;
  agentId: Uint8Array;
  capabilityPda: PublicKey;
  rpcUrl: string;
  usdcMint: PublicKey;
  payerTokenAccount: PublicKey;
}

export interface X402FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  maxAmount: number; // USDC base units (6 decimals)
  actionNonce: number;
}

export interface X402FetchResult {
  status: number;
  ok: boolean;
  data: any;
  paymentMade: boolean;
  capabilityAsserted: boolean;
  signature?: string;
}

/**
 * PACTYRA x402 Adapter
 *
 * Wraps HTTP fetch calls with:
 * 1. PACTYRA assert_capability check (verifies the agent has earned authority)
 * 2. x402 payment facilitation (pays the USDC if capability is valid)
 *
 * This proves PACTYRA can gate agentic payments with earned authority.
 */
export class PactyraX402Adapter {
  private client: PactyraClient;
  private agentId: Uint8Array;
  private capabilityPda: PublicKey;
  private connection: Connection;
  private usdcMint: PublicKey;
  private payerTokenAccount: PublicKey;

  constructor(config: PactyraX402AdapterConfig) {
    this.client = config.pactyraClient;
    this.agentId = config.agentId;
    this.capabilityPda = config.capabilityPda;
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.usdcMint = config.usdcMint;
    this.payerTokenAccount = config.payerTokenAccount;
  }

  /**
   * Make a paid HTTP request gated by PACTYRA capability.
   *
   * 1. Fetch the resource — if it returns 402, extract payment requirements
   * 2. Assert capability — verify the agent has earned the right to pay
   * 3. Facilitate payment — transfer USDC to the payee
   * 4. Retry the request with payment proof — get the resource
   */
  async fetch(
    url: string,
    options: X402FetchOptions
  ): Promise<X402FetchResult> {
    const { method = 'GET', headers = {}, body, maxAmount, actionNonce } = options;

    // Step 1: Initial request — expect 402 if payment is required
    const initialResponse = await fetch(url, { method, headers, body });
    const status = initialResponse.status;

    // If not 402, return the response directly (no payment needed)
    if (status !== 402) {
      const data = await this.parseResponse(initialResponse);
      return {
        status,
        ok: initialResponse.ok,
        data,
        paymentMade: false,
        capabilityAsserted: false,
      };
    }

    // Step 2: Parse 402 payment requirements
    const paymentData: X402PaymentResponse = await initialResponse.json();
    const requirement = paymentData.requires?.[0];

    if (!requirement) {
      return {
        status: 402,
        ok: false,
        data: { error: 'No payment requirements in 402 response' },
        paymentMade: false,
        capabilityAsserted: false,
      };
    }

    // Verify the payment amount is within the agent's capability limit
    const requiredAmount = parseInt(requirement.maxTotalAmount.value);
    if (requiredAmount > maxAmount) {
      return {
        status: 402,
        ok: false,
        data: {
          error: 'AmountExceedsCapability',
          message: `Required ${requiredAmount} but capability max is ${maxAmount}`,
        },
        paymentMade: false,
        capabilityAsserted: false,
      };
    }

    // Step 3: Assert PACTYRA capability BEFORE paying
    // This is the key integration: the agent must have earned the right to pay
    try {
      const targetProgram = new PublicKey(requirement.resource || url);
      const targetAccount = new PublicKey(requirement.payTo);

      await this.client.assertCapability(this.agentId, {
        actionType: 'payService' as any,
        targetProgram: targetProgram.toString(),
        targetAccount: targetAccount.toString(),
        amount: requiredAmount,
        actionNonce,
      });
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
      };
    }

    // Step 4: Capability is valid — facilitate the x402 payment
    // Transfer USDC from the payer's token account to the payee
    const payTo = new PublicKey(requirement.payTo);
    const paymentSignature = await this.facilitatePayment(
      requiredAmount,
      payTo
    );

    // Step 5: Retry the request with payment proof
    const paidResponse = await fetch(url, {
      method,
      headers: {
        ...headers,
        'X-PAYMENT': paymentSignature,
        'X-PAYMENT-NETWORK': requirement.network || 'solana-devnet',
      },
      body,
    });

    const paidData = await this.parseResponse(paidResponse);

    return {
      status: paidResponse.status,
      ok: paidResponse.ok,
      data: paidData,
      paymentMade: true,
      capabilityAsserted: true,
      signature: paymentSignature,
    };
  }

  /**
   * Facilitate a USDC payment via SPL token transfer.
   * In production, this would use the x402 facilitator protocol.
   * For the hackathon demo, it uses a direct SPL token transfer.
   */
  private async facilitatePayment(
    amount: number,
    payTo: PublicKey
  ): Promise<string> {
    // This is a simplified facilitator — in production, you'd use
    // the x402-solana package's facilitator or @payai/facilitator
    //
    // The key point: this payment only happens AFTER assert_capability passes
    //
    // For the hackathon, we return a mock signature since the actual
    // transfer requires the payer's wallet to sign (which the adapter
    // would facilitate via wallet adapter in a real app)

    // In a real implementation:
    // 1. Create an SPL token transfer instruction (payer → payTo)
    // 2. Sign with the agent's wallet (via wallet adapter)
    // 3. Submit to the network
    // 4. Return the transaction signature

    // For now, return a simulated signature
    const simulatedSig = `pactyra_x402_${Date.now()}_${amount}_${payTo.toString().slice(0, 8)}`;
    return simulatedSig;
  }

  /**
   * Parse an HTTP response as JSON or text.
   */
  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }

  /**
   * Check if a capability is valid for a given amount without making a payment.
   * Useful for pre-flight checks before attempting a paid request.
   */
  async checkCapability(amount: number): Promise<boolean> {
    try {
      const agent = await this.client.getAgent(this.agentId);
      const tierMax = this.client.getTierMaxAmount(agent.tier);
      return amount <= tierMax;
    } catch {
      return false;
    }
  }

  /**
   * Get the agent's current authority tier and max capability amount.
   */
  async getAuthorityInfo(): Promise<{ tier: string; maxAmount: number }> {
    const agent = await this.client.getAgent(this.agentId);
    return {
      tier: this.client.getTierName(agent.tier),
      maxAmount: this.client.getTierMaxAmount(agent.tier),
    };
  }
}
