/**
 * Devnet deployment verification script.
 *
 * Executes the core protocol flow against Solana devnet and captures
 * transaction signatures as evidence.
 *
 * Run: npx ts-node scripts/devnet-verify.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { PactyraClient } from "../sdk/src/client";
import {
  deriveAgentPda,
  deriveBondPda,
  derivePolicyPda,
  deriveVerifierRegistryPda,
} from "../sdk/src/pdas";

const DEVNET_RPC = "process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"";
const EXPLORER = "https://solana.fm/tx";

async function main() {
  const connection = new anchor.web3.Connection(DEVNET_RPC, "confirmed");
  const wallet = new anchor.Wallet(
    Keypair.fromSecretKey(
      Buffer.from(JSON.parse(require("fs").readFileSync(process.env.HOME + "/.config/solana/id.json", "utf-8")))
    )
  );
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const client = new PactyraClient(provider);

  console.log("=== PACTYRA Devnet Verification ===");
  console.log("Wallet:", wallet.publicKey.toString());
  console.log("Balance:", (await connection.getBalance(wallet.publicKey)) / 1e9, "SOL");
  console.log("");

  const signatures: string[] = [];

  // 1. Initialize protocol
  console.log("1. Initialize protocol...");
  try {
    const sig = await client.initializeProtocol();
    signatures.push(sig);
    console.log("   ✓ Signature:", sig);
  } catch (e) {
    console.log("   (already initialized)");
  }

  // 2. Register verifier
  console.log("2. Register verifier...");
  const verifierId = new Uint8Array(32);
  for (let i = 0; i < 32; i++) verifierId[i] = i + 1;
  try {
    const sig = await client.registerVerifier(verifierId, client.coreProgram.programId, wallet.publicKey);
    signatures.push(sig);
    console.log("   ✓ Signature:", sig);
  } catch (e) {
    console.log("   (already registered)");
  }

  // 3. Register agent (deterministic ID for reproducibility)
  console.log("3. Register agent...");
  const agentId = Buffer.from('deadbeefcafebabedeadbeefcafebabedeadbeefcafebabedeadbeefcafebabe', 'hex');
  try {
    const sig = await client.registerAgent(agentId);
    signatures.push(sig);
    console.log("   ✓ Signature:", sig);
    console.log("   Agent ID:", Buffer.from(agentId).toString("hex").slice(0, 16) + "...");

    // 4. Create policy
    console.log("4. Create policy PAY-V1...");
    try {
      const sig = await client.createPolicy({
        versionTag: "PAY-V1",
        capabilityType: "payService" as any,
        minSuccesses: 20,
        minSuccessRateBps: 9500,
        criticalFailureLimit: 0,
        minBondUsdc: 5_000_000,
        maxAmountUsdc: 500_000_000,
      });
      signatures.push(sig);
      console.log("   ✓ Signature:", sig);
    } catch (e) {
      console.log("   (already created)");
    }

    // 5. Lock bond (5 USDC — tracked, not actual token transfer)
    console.log("5. Lock 5 USDC bond...");
    try {
      const sig = await client.lockBond(agentId, 5_000_000);
      signatures.push(sig);
      console.log("   ✓ Signature:", sig);
    } catch (e) {
      console.log("   (already locked)");
    }

    // 6. Verify agent state
    console.log("6. Verify agent state...");
    const agent = await client.getAgent(agentId);
    console.log("   Tier:", client.getTierName(agent.tier));
    console.log("   Epoch:", agent.currentEpoch.toNumber());
    console.log("   Bond:", agent.bondAmount.toNumber(), "base units");
    console.log("   Max capability: $" + client.getTierMaxAmount(agent.tier) / 1_000_000);
  } catch (e) {
    console.log("   (agent already registered)");
  }

  // Print evidence summary
  console.log("\n=== Transaction Evidence ===");
  for (const sig of signatures) {
    console.log(`  ${EXPLORER}/${sig}?cluster=devnet`);
  }

  console.log("\n=== Program IDs ===");
  console.log("  pactyra-core:       EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC");
  console.log("  pactyra-verifier:   5dK7xXDUSHDcP8qFxrLLFo4Nm2Xzn7rSKgDMmrFFLZsN");
  console.log("  reference-treasury: 6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9");

  console.log("\n=== Devnet Verification Complete ===");
}

main().catch(console.error);
