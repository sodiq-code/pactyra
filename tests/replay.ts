/**
 * Test suite: Replay protection
 *
 * Tests that the same action nonce cannot be used twice.
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { airdrop, makeId, TIER_1_MAX, BOND_AMOUNT } from "./helpers";

describe("replay", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.PactyraCore as any;

  let authority: Keypair;
  let agentId: Uint8Array;
  let agentPda: PublicKey;
  let bondPda: PublicKey;
  let policyPda: PublicKey;
  let verifierRegistryPda: PublicKey;
  let capabilityPda: PublicKey;

  before(async () => {
    authority = Keypair.generate();
    await airdrop(provider.connection, authority.publicKey, 50);
    await airdrop(provider.connection, provider.wallet.publicKey, 50);

    const agentKeypair = Keypair.generate();
    agentId = agentKeypair.publicKey.toBytes();

    [verifierRegistryPda] = PublicKey.findProgramAddressSync([Buffer.from("verifier_registry")], program.programId);
    [agentPda] = PublicKey.findProgramAddressSync([Buffer.from("agent"), Buffer.from(agentId)], program.programId);
    [policyPda] = PublicKey.findProgramAddressSync([Buffer.from("policy"), Buffer.from("PAY-V1")], program.programId);
    [bondPda] = PublicKey.findProgramAddressSync([Buffer.from("bond"), Buffer.from(agentId)], program.programId);

    try { await program.methods.initializeProtocol().accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    const verifierId = new Uint8Array(32);
    for (let i = 0; i < 32; i++) verifierId[i] = i + 50;
    try { await program.methods.registerVerifier(Array.from(verifierId), program.programId, provider.wallet.publicKey).accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await program.methods.registerAgent(Array.from(agentId)).accounts({ agent: agentPda, authority: authority.publicKey, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
    try { await program.methods.createPolicy({ versionTag: "PAY-V1", capabilityType: { payService: {} }, minSuccesses: new BN(20), minSuccessRateBps: 9500, criticalFailureLimit: new BN(0), minBondUsdc: new BN(5_000_000), maxAmountUsdc: new BN(500_000_000) }).accounts({ policy: policyPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await program.methods.lockBond(BOND_AMOUNT).accounts({ agent: agentPda, bond: bondPda, authorityRoot: authority.publicKey, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
  });

  it("First use of nonce passes", async () => {
    const agent = await program.account.agent.fetch(agentPda);
    const epoch = agent.currentEpoch;
    const tp = Keypair.generate().publicKey;
    const ta = Keypair.generate().publicKey;
    [capabilityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("capability"), Buffer.from(agentId), epoch.toArrayLike(Buffer, "le", 8), tp.toBuffer()], program.programId
    );
    await program.methods.requestCapability({
      capabilityType: { payService: {} }, targetProgram: tp, targetAccount: ta,
      amountLimit: TIER_1_MAX, frequencyLimit: new BN(10), ttlSeconds: new BN(3600),
    }).accounts({
      agent: agentPda, policy: policyPda, capability: capabilityPda,
      authorityRoot: authority.publicKey, systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    const nonce = new BN(1);
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nonce"), Buffer.from(agentId), nonce.toArrayLike(Buffer, "le", 8)], program.programId
    );
    await program.methods.assertCapability({
      actionType: { payService: {} }, targetProgram: tp, targetAccount: ta,
      amount: TIER_1_MAX, actionNonce: nonce,
    }).accounts({
      agent: agentPda, capability: capabilityPda, policy: policyPda,
      consumedNonce: consumedNoncePda, authorityRoot: authority.publicKey,
      systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();
  });

  it("Replay with same nonce rejected — account already exists", async () => {
    const cap = await program.account.capability.fetch(capabilityPda);
    const nonce = new BN(1); // reuse nonce
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nonce"), Buffer.from(agentId), nonce.toArrayLike(Buffer, "le", 8)], program.programId
    );
    try {
      await program.methods.assertCapability({
        actionType: { payService: {} }, targetProgram: cap.targetProgram,
        targetAccount: cap.targetAccount, amount: TIER_1_MAX, actionNonce: nonce,
      }).accounts({
        agent: agentPda, capability: capabilityPda, policy: policyPda,
        consumedNonce: consumedNoncePda, authorityRoot: authority.publicKey,
        systemProgram: SystemProgram.programId,
      }).signers([authority]).rpc();
      expect.fail("Should reject replay");
    } catch (err: any) {
      expect(err.toString()).to.match(/already in use|account already exists|0x1|ConstraintSeeds/i);
    }
  });
});
