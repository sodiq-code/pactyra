/**
 * Bootstrap script — initializes the protocol, registers a verifier, an agent,
 * creates a policy, and locks a bond.
 *
 * Run: npx ts-node scripts/bootstrap.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PactyraClient } from "../sdk/src/client";
import {
  deriveAgentPda,
  deriveBondPda,
  derivePolicyPda,
  deriveVerifierRegistryPda,
} from "../sdk/src/pdas";

async function main() {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const client = new PactyraClient(provider);

  const authority = Keypair.generate();
  const verifierOperator = Keypair.generate();

  // Airdrop SOL
  console.log("Airdropping SOL...");
  await provider.connection.requestAirdrop(authority.publicKey, 50 * LAMPORTS_PER_SOL);
  await provider.connection.requestAirdrop(verifierOperator.publicKey, 10 * LAMPORTS_PER_SOL);

  // Generate agent ID
  const agentId = Buffer.from('deadbeefcafebabedeadbeefcafebabedeadbeefcafebabedeadbeefcafebabe', 'hex');
  const 

  console.log("\n=== Bootstrap ===");
  console.log("Authority:", authority.publicKey.toString());
  console.log("Verifier Operator:", verifierOperator.publicKey.toString());
  console.log("Agent ID:", Buffer.from(agentId).toString("hex"));

  // Initialize protocol
  console.log("\n1. Initialize protocol...");
  await client.initializeProtocol();
  console.log("   VerifierRegistry created");

  // Register verifier
  console.log("\n2. Register verifier...");
  const verifierId = new Uint8Array(32);
  for (let i = 0; i < 32; i++) verifierId[i] = i + 10;
  await client.registerVerifier(verifierId, client.coreProgram.programId, verifierOperator.publicKey);
  console.log("   Verifier registered");

  // Register agent
  console.log("\n3. Register agent...");
  await client.registerAgent(agentId);
  const agent = await client.getAgent(agentId);
  console.log("   Agent at Tier:", client.getTierName(agent.tier));
  console.log("   Epoch:", agent.currentEpoch.toNumber());

  // Create policy
  console.log("\n4. Create policy PAY-V1...");
  await client.createPolicy({
    versionTag: "PAY-V1",
    capabilityType: "payService" as any,
    minSuccesses: 20,
    minSuccessRateBps: 9500,
    criticalFailureLimit: 0,
    minBondUsdc: 5_000_000,
    maxAmountUsdc: 500_000_000,
  });
  console.log("   Policy created (min 20 successes, 95% rate, 5 USDC bond, max $500)");

  // Lock bond
  console.log("\n5. Lock 5 USDC bond...");
  await client.lockBond(agentId, 5_000_000);
  const updatedAgent = await client.getAgent(agentId);
  console.log("   Bond amount:", updatedAgent.bondAmount.toNumber(), "USDC base units");

  console.log("\n=== Bootstrap complete ===");
  console.log("Agent is now at Tier 1 (Probation) with $5 max capability.");
  console.log("Run earn-tier2.ts next to earn authority upgrade.");
}

main().catch(console.error);
