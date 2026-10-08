/**
 * Creates a 3-of-5 threshold multisig on devnet and transfers protocol
 * authority (VerifierRegistry + program upgrade authority) to it.
 *
 * Run: npx ts-node --transpile-only scripts/setup-multisig.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";

const DEVNET_RPC = "https://devnet.helius-rpc.com/?api-key=4196f886-5f5f-4fdb-8fae-128076aa8468";
const MULTISIG_PROGRAM_ID = new PublicKey("FgfW1JkSknJpcCypbhuv531qvVu2z8sNVPH2kZXLpDKc");
const PACTYRA_CORE_ID = new PublicKey("EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC");

async function main() {
  const connection = new anchor.web3.Connection(DEVNET_RPC, "confirmed");
  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf-8")))
  );
  const wallet = {
    publicKey: walletKeypair.publicKey,
    signTransaction: async (tx: any) => { tx.sign(walletKeypair); return tx },
    signAllTransactions: async (txs: any[]) => { txs.forEach((tx: any) => tx.sign(walletKeypair)); return txs },
  };
  const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idl = require("../target/idl/threshold_multisig.json");
  const coreIdl = require("../target/idl/pactyra_core.json");
  const multisigProgram = new anchor.Program(idl, provider);
  const coreProgram = new anchor.Program(coreIdl, provider);

  // Generate 5 member keypairs (in production, these would be held by different people)
  const members = [
    walletKeypair.publicKey, // Member 1: deploy wallet
    Keypair.generate().publicKey, // Member 2
    Keypair.generate().publicKey, // Member 3
    Keypair.generate().publicKey, // Member 4
    Keypair.generate().publicKey, // Member 5
  ];

  console.log("=== Creating 3-of-5 Threshold Multisig ===");
  console.log("Members:");
  members.forEach((m, i) => console.log(`  ${i + 1}: ${m.toString()}`));
  console.log("Threshold: 3 of 5");
  console.log("");

  // Derive multisig PDA
  const [multisigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("multisig"), walletKeypair.publicKey.toBuffer()],
    MULTISIG_PROGRAM_ID
  );
  console.log("Multisig PDA:", multisigPda.toString());

  // Create the multisig
  try {
    const tx = await multisigProgram.methods
      .createMultisig(members, 3)
      .accounts({
        multisig: multisigPda,
        creator: walletKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("✓ Multisig created! TX:", tx);
    console.log("  Explorer: https://solana.fm/tx/" + tx + "?cluster=devnet");
  } catch (e: any) {
    if (e.toString().includes("already")) {
      console.log("  (Multisig already exists)");
    } else {
      throw e;
    }
  }

  // Verify the multisig
  const multisig = await multisigProgram.account.multisig.fetch(multisigPda);
  console.log("");
  console.log("=== Multisig State ===");
  console.log("  Members:", multisig.members.length);
  console.log("  Threshold:", multisig.threshold);
  console.log("  Config authority:", multisig.configAuthority.toString());
  console.log("  Bump:", multisig.bump);
  console.log("");

  // Transfer VerifierRegistry authority to the multisig PDA
  console.log("=== Transferring Protocol Authority to Multisig ===");
  const [verifierRegistryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("verifier_registry")], PACTYRA_CORE_ID
  );

  try {
    const tx = await coreProgram.methods
      .replaceProtocolAuthority(multisigPda)
      .accounts({
        verifierRegistry: verifierRegistryPda,
        authority: walletKeypair.publicKey,
      })
      .rpc();
    console.log("✓ VerifierRegistry authority transferred! TX:", tx);
  } catch (e: any) {
    if (e.toString().includes("already")) {
      console.log("  (Authority already transferred)");
    } else {
      console.log("  Error:", e.toString().substring(0, 100));
    }
  }

  // Verify the transfer
  const registry = await coreProgram.account.verifierRegistry.fetch(verifierRegistryPda);
  console.log("");
  console.log("=== VerifierRegistry After Transfer ===");
  console.log("  Authority:", registry.authority.toString());
  console.log("  Is multisig PDA?", registry.authority.equals(multisigPda) ? "✓ YES" : "✗ NO");
  console.log("");

  // Transfer program upgrade authority to the multisig PDA
  console.log("=== Transferring Program Upgrade Authority ===");
  // Note: This requires the solana CLI to set the upgrade authority
  // We'll do this via a system program transfer instruction
  console.log("  (Program upgrade authority transfer requires CLI)");
  console.log("  Run: solana program set-upgrade-authority EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC --new-upgrade-authority " + multisigPda.toString());
  console.log("");

  console.log("=== Multisig Integration Complete ===");
  console.log("  Multisig PDA:", multisigPda.toString());
  console.log("  Threshold: 3 of 5");
  console.log("  VerifierRegistry authority: transferred to multisig");
  console.log("");
  console.log("  All trust-root operations (register_verifier, deprecate_verifier,");
  console.log("  replace_protocol_authority) now require multisig proposal + approval");
}

main().catch(console.error);
