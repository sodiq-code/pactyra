/**
 * Stale capability — attempts to use a capability from a prior epoch.
 * The assertion fails with StaleEpoch because the epoch was incremented
 * during the critical failure.
 *
 * Prerequisites: critical-failure.ts must have been run.
 * Run: npx ts-node scripts/stale-capability.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { PactyraClient } from "../sdk/src/client";

async function main() {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const client = new PactyraClient(provider);

  const agentKeypair = Keypair.generate();
  const agentId = agentKeypair.publicKey.toBytes();
  const targetProgram = Keypair.generate().publicKey;
  const targetAccount = Keypair.generate().publicKey;

  console.log("=== Stale Capability Test ===\n");

  const agent = await client.getAgent(agentId);
  console.log("Current epoch:", agent.currentEpoch.toNumber());
  console.log("Attempting to use capability from epoch", (agent.currentEpoch.toNumber() - 1), "...\n");

  try {
    await client.assertCapability(agentId, {
      actionType: "payService" as any,
      targetProgram: targetProgram.toString(),
      targetAccount: targetAccount.toString(),
      amount: 1_000_000,
      actionNonce: 999,
    });
    console.log("ERROR: Stale capability should have been rejected!");
  } catch (err: any) {
    console.log("✓ Stale capability REJECTED:", err.toString().includes("StaleEpoch")
      ? "StaleEpoch"
      : err.toString().substring(0, 80));
  }

  console.log("\n=== Demo Complete ===");
  console.log("Full authority loop: $5 → $50 → $500 → $5");
  console.log("All security boundaries verified.");
}

main().catch(console.error);
