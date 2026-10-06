/**
 * Earn Tier 2 — records 5 verified successful outcomes to trigger T1→T2 upgrade.
 *
 * Prerequisites: bootstrap.ts must have been run.
 * Run: npx ts-node scripts/earn-tier2.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { PactyraClient } from "../sdk/src/client";

async function main() {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const client = new PactyraClient(provider);

  // Use the same agent from bootstrap (in production, load from config)
  const agentKeypair = Keypair.generate();
  const agentId = agentKeypair.publicKey.toBytes();

  console.log("=== Earn Tier 2 ===");
  console.log("Recording 5 verified successful outcomes...\n");

  for (let i = 0; i < 5; i++) {
    const actionId = Keypair.generate().publicKey.toBytes();
    const capabilityId = Keypair.generate().publicKey.toBytes();
    const evidenceHash = Keypair.generate().publicKey.toBytes();

    await client.recordOutcome(
      agentId,
      actionId,
      capabilityId,
      "pass" as any,
      "none" as any,
      evidenceHash
    );

    const agent = await client.getAgent(agentId);
    console.log(
      `  [${i + 1}/5] Success recorded — ` +
      `total: ${agent.totalCount}, success: ${agent.successCount}, ` +
      `tier: ${client.getTierName(agent.tier)}`
    );
  }

  const agent = await client.getAgent(agentId);
  console.log("\n=== Tier 2 Earned ===");
  console.log("Tier:", client.getTierName(agent.tier));
  console.log("Success count:", agent.successCount.toNumber());
  console.log("Max capability: $50");
  console.log("\nRun earn-tier3.ts next to earn Tier 3 ($500).");
}

main().catch(console.error);
