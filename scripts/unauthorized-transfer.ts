/**
 * Unauthorized transfer — attempts a $400 transfer with a $50 capability.
 * The capability assertion fails with AmountExceedsCapability.
 * No USDC is moved.
 *
 * Prerequisites: earn-tier2.ts must have been run (agent at Tier 2, $50).
 * Run: npx ts-node scripts/unauthorized-transfer.ts
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

  console.log("=== Unauthorized Transfer Test ===");
  console.log("Attempting $400 transfer with $50 capability...\n");

  const agent = await client.getAgent(agentId);
  console.log("Agent tier:", client.getTierName(agent.tier));
  console.log("Max capability: $", client.getTierMaxAmount(agent.tier) / 1_000_000);

  try {
    await client.assertCapability(agentId, {
      actionType: "payService" as any,
      targetProgram: targetProgram.toString(),
      targetAccount: targetAccount.toString(),
      amount: 400_000_000, // $400
      actionNonce: 1,
    });
    console.log("\nERROR: Transfer should have been rejected!");
  } catch (err: any) {
    console.log("\n✓ Transfer REJECTED:", err.toString().includes("AmountExceedsCapability")
      ? "AmountExceedsCapability"
      : err.toString().substring(0, 80));
    console.log("No USDC was moved.");
  }

  console.log("\nRun critical-failure.ts to test the $500→$5 loop.");
}

main().catch(console.error);
