/**
 * x402 Adapter Demo
 *
 * Demonstrates PACTYRA gating x402 agentic payments with earned authority.
 *
 * The flow:
 * 1. Agent has a PACTYRA capability (earned through verified performance)
 * 2. Agent requests a resource from an x402-enabled service
 * 3. Service returns 402 Payment Required
 * 4. PACTYRA adapter checks assert_capability — is the agent authorized?
 * 5. If authorized: adapter facilitates the USDC payment
 * 6. Service returns the resource
 *
 * Run: npx ts-node --transpile-only scripts/x402-demo.ts
 */

import { PublicKey } from '@solana/web3.js';

// Simulated x402 flow — demonstrates the integration concept
async function main() {
  console.log('=== PACTYRA x402 Adapter Demo ===\n');

  console.log('Concept: PACTYRA gates x402 agentic payments with earned authority.\n');

  console.log('Flow:');
  console.log('  1. Agent requests resource from x402-enabled service');
  console.log('  2. Service returns 402 Payment Required');
  console.log('  3. PACTYRA adapter calls assert_capability()');
  console.log('     → Checks: agent active, capability active, epoch current,');
  console.log('       target matches, amount within limit, bond satisfied');
  console.log('  4. If capability PASSES: adapter facilitates USDC payment');
  console.log('  5. If capability FAILS: payment is NOT made, request rejected');
  console.log('  6. Service returns resource (if paid) or 403 (if not)');
  console.log('');

  // Simulate the adapter
  const PERMANENT_AGENT = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

  console.log('=== Simulated x402 Request ===\n');
  console.log('Agent:', PERMANENT_AGENT.slice(0, 16) + '...');
  console.log('Service URL: https://api.example-service.com/data');
  console.log('Expected 402: maxTotalAmount = 5,000,000 USDC base units ($5)');
  console.log('');

  // Step 1: Check capability before making the request
  console.log('Step 1: Pre-flight capability check...');
  const agentState = await fetch(
    `https://pactyra-ui.vercel.app/api/agent?id=${PERMANENT_AGENT}`
  ).then(r => r.json()).catch(() => null);

  if (agentState?.found) {
    console.log(`  ✓ Agent found on devnet`);
    console.log(`  Tier: ${agentState.tier}`);
    console.log(`  Max capability: $${agentState.maxAmount}`);
    console.log(`  Bond: ${agentState.bondAmount / 1_000_000} USDC`);
    console.log('');

    if (agentState.maxAmount >= 5) {
      console.log('Step 2: Capability sufficient ($5 ≤ $' + agentState.maxAmount + ')');
      console.log('  ✓ assert_capability would PASS');
      console.log('');
      console.log('Step 3: Facilitate x402 payment...');
      console.log('  → SPL token transfer: 5 USDC from agent → service');
      console.log('  → Payment signature: pactyra_x402_' + Date.now());
      console.log('  ✓ Payment facilitated');
      console.log('');
      console.log('Step 4: Retry request with payment proof...');
      console.log('  → X-PAYMENT header set');
      console.log('  ✓ Service returns 200 OK with resource');
      console.log('');
      console.log('=== Result: x402 payment gated by PACTYRA capability ===');
      console.log('The agent could only pay because it earned the authority.');
    } else {
      console.log('Step 2: Capability insufficient');
      console.log(`  ✗ Max capability ($${agentState.maxAmount}) < required ($5)`);
      console.log('  → assert_capability would FAIL: AmountExceedsCapability');
      console.log('  → Payment NOT made');
      console.log('  → Request rejected');
    }
  } else {
    console.log('  ✗ Agent not found');
  }

  console.log('');
  console.log('=== Integration Architecture ===');
  console.log('');
  console.log('  Agent → HTTP GET /api/resource');
  console.log('         ← 402 Payment Required (x402)');
  console.log('  Adapter → assert_capability(agent, action, amount)');
  console.log('           → Checks 13 security conditions');
  console.log('           → PASS: continue to payment');
  console.log('           → FAIL: reject, no payment');
  console.log('  Adapter → SPL token transfer (USDC)');
  console.log('         ← Transaction signature');
  console.log('  Agent → HTTP GET /api/resource + X-PAYMENT header');
  console.log('         ← 200 OK + resource');
  console.log('');
  console.log('=== Key Insight ===');
  console.log('');
  console.log('  Without PACTYRA: any agent with a wallet can pay for any service.');
  console.log('  With PACTYRA: the agent must EARN the authority to pay through');
  console.log('  verified performance. A compromised or new agent starts at $5');
  console.log('  and must prove itself before it can spend more.');
  console.log('');
  console.log('  This is the x402 integration: PACTYRA gates agentic payments');
  console.log('  with earned authority.');
}

main().catch(console.error);
