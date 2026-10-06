/**
 * Critical failure — records a critical failure to trigger:
 *   1. Bond slash (5 USDC → 0)
 *   2. Authority downgrade (Tier 3 → Tier 1)
 *   3. Epoch increment (invalidates all outstanding capabilities)
 *
 * Prerequisites: earn-tier3.ts must have been run (agent at Tier 3, $500).
 * Run: npx ts-node scripts/critical-failure.ts
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

  console.log("=== Critical Failure ===");

  const before = await client.getAgent(agentId);
  console.log("Before:");
  console.log("  Tier:", client.getTierName(before.tier));
  console.log("  Epoch:", before.currentEpoch.toNumber());
  console.log("  Bond:", before.bondAmount.toNumber(), "USDC base units");
  console.log("  Max capability: $", client.getTierMaxAmount(before.tier) / 1_000_000);

  console.log("\nRecording critical failure (Pyth price age: 97s, max: 30s)...\n");

  const actionId = Keypair.generate().publicKey.toBytes();
  const capabilityId = Keypair.generate().publicKey.toBytes();
  const evidenceHash = Keypair.generate().publicKey.toBytes();

  await client.recordOutcome(
    agentId, actionId, capabilityId,
    "fail" as any, "critical" as any, evidenceHash
  );

  const after = await client.getAgent(agentId);
  console.log("After:");
  console.log("  Tier:", client.getTierName(after.tier));
  console.log("  Epoch:", after.currentEpoch.toNumber());
  console.log("  Bond:", after.bondAmount.toNumber(), "USDC base units");
  console.log("  Critical failures:", after.criticalFailures.toNumber());
  console.log("  Max capability: $", client.getTierMaxAmount(after.tier) / 1_000_000);

  console.log("\n=== Authority Collapsed: $500 → $5 ===");
  console.log("Bond slashed, epoch incremented, old capabilities invalidated.");
  console.log("\nRun stale-capability.ts to verify old capabilities are rejected.");
}

main().catch(console.error);
