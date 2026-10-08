/**
 * PROTOCOL STATE-MACHINE TEST HARNESS
 *
 * This script directly calls record_outcome() to advance the agent through
 * protocol state transitions. It bypasses the verifier path and is intended
 * for testing the state machine, not as a production-grade proof path.
 *
 * The judge-facing demo uses the real verifier path via the x402 demo endpoint:
 * https://pactyra-ui.vercel.app/api/x402/demo
 *
 * Run: npx ts-node --transpile-only scripts/earn-tier3.ts
 */

/**
 * Earn Tier 3 — records 22 more successes + 1 ordinary fail (27/28 = 96.4%)
 * to trigger T2→T3 upgrade.
 *
 * Prerequisites: earn-tier2.ts must have been run.
 * Run: npx ts-node scripts/earn-tier3.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { PactyraClient } from "../sdk/src/client";

async function main() {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const client = new PactyraClient(provider);

  const agentId = Buffer.from('deadbeefcafebabedeadbeefcafebabedeadbeefcafebabedeadbeefcafebabe', 'hex');
  const 

  console.log("=== Earn Tier 3 ===");
  console.log("Recording 22 more successes + 1 ordinary fail...\n");

  // 22 successes
  for (let i = 0; i < 22; i++) {
    const actionId = Keypair.generate().publicKey.toBytes();
    const capabilityId = Keypair.generate().publicKey.toBytes();
    const evidenceHash = Keypair.generate().publicKey.toBytes();

    await client.recordOutcome(
      agentId, actionId, capabilityId,
      "pass" as any, "none" as any, evidenceHash
    );
  }
  console.log("  22 successes recorded");

  // 1 ordinary fail
  const failActionId = Keypair.generate().publicKey.toBytes();
  const failCapId = Keypair.generate().publicKey.toBytes();
  const failEvidence = Keypair.generate().publicKey.toBytes();
  await client.recordOutcome(
    agentId, failActionId, failCapId,
    "fail" as any, "ordinary" as any, failEvidence
  );
  console.log("  1 ordinary failure recorded");

  const agent = await client.getAgent(agentId);
  console.log("\n=== Tier 3 Earned ===");
  console.log("Tier:", client.getTierName(agent.tier));
  console.log("Success count:", agent.successCount.toNumber());
  console.log("Total count:", agent.totalCount.toNumber());
  console.log("Success rate:", client.getSuccessRate(agent.successCount, agent.totalCount).toFixed(1) + "%");
  console.log("Critical failures:", agent.criticalFailures.toNumber());
  console.log("Max capability: $500");
  console.log("\nRun unauthorized-transfer.ts to test rejection.");
}

main().catch(console.error);
