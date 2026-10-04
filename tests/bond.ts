/**
 * Test suite: Bond lifecycle
 *
 * Tests:
 * - Bond lock
 * - Bond slash on critical failure
 * - Bond re-lock after slash
 * - Insufficient bond rejects capability request
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { airdrop, makeId, BOND_AMOUNT } from "./helpers";

describe("bond", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.PactyraCore as any;

  let authority: Keypair;
  let verifierOperator: Keypair;
  let agentId: Uint8Array;
  let agentPda: PublicKey;
  let bondPda: PublicKey;
  let policyPda: PublicKey;
  let verifierRegistryPda: PublicKey;

  async function recordCritical() {
    const actionId = makeId();
    const capabilityId = makeId();
    const evidenceHash = makeId();
    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), Buffer.from(agentId), Buffer.from(actionId)], program.programId
    );
    await program.methods.recordOutcome(
      Array.from(actionId), Array.from(capabilityId), { fail: {} }, { critical: {} }, Array.from(evidenceHash)
    ).accounts({
      agent: agentPda, receipt: receiptPda, verifierRegistry: verifierRegistryPda,
      policy: policyPda, bond: bondPda, verifierOperator: verifierOperator.publicKey,
      systemProgram: SystemProgram.programId,
    }).signers([verifierOperator]).rpc();
  }

  before(async () => {
    authority = Keypair.generate();
    verifierOperator = Keypair.generate();
    await airdrop(provider.connection, authority.publicKey, 50);
    await airdrop(provider.connection, verifierOperator.publicKey, 10);
    await airdrop(provider.connection, provider.wallet.publicKey, 50);

    const agentKeypair = Keypair.generate();
    agentId = agentKeypair.publicKey.toBytes();

    [verifierRegistryPda] = PublicKey.findProgramAddressSync([Buffer.from("verifier_registry")], program.programId);
    [agentPda] = PublicKey.findProgramAddressSync([Buffer.from("agent"), Buffer.from(agentId)], program.programId);
    [policyPda] = PublicKey.findProgramAddressSync([Buffer.from("policy"), Buffer.from("PAY-V1")], program.programId);
    [bondPda] = PublicKey.findProgramAddressSync([Buffer.from("bond"), Buffer.from(agentId)], program.programId);

    try { await program.methods.initializeProtocol().accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    const verifierId = new Uint8Array(32);
    for (let i = 0; i < 32; i++) verifierId[i] = i + 80;
    try { await program.methods.registerVerifier(Array.from(verifierId), program.programId, verifierOperator.publicKey).accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await program.methods.registerAgent(Array.from(agentId)).accounts({ agent: agentPda, authority: authority.publicKey, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
    try { await program.methods.createPolicy({ versionTag: "PAY-V1", capabilityType: { payService: {} }, minSuccesses: new BN(20), minSuccessRateBps: 9500, criticalFailureLimit: new BN(0), minBondUsdc: new BN(5_000_000), maxAmountUsdc: new BN(500_000_000) }).accounts({ policy: policyPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
  });

  it("Bond lock works", async () => {
    await program.methods.lockBond(BOND_AMOUNT).accounts({
      agent: agentPda, bond: bondPda, authorityRoot: authority.publicKey,
      systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.bondAmount.toNumber()).to.equal(5_000_000);
    const bond = await program.account.bond.fetch(bondPda);
    expect(bond.amount.toNumber()).to.equal(5_000_000);
    expect(bond.slashed).to.equal(false);
  });

  it("Bond slash on critical failure", async () => {
    await recordCritical();
    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.bondAmount.toNumber()).to.equal(0);
    const bond = await program.account.bond.fetch(bondPda);
    expect(bond.slashed).to.equal(true);
    expect(bond.amount.toNumber()).to.equal(0);
  });

  it("Bond re-lock after slash works", async () => {
    await program.methods.lockBond(BOND_AMOUNT).accounts({
      agent: agentPda, bond: bondPda, authorityRoot: authority.publicKey,
      systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.bondAmount.toNumber()).to.equal(5_000_000);
    const bond = await program.account.bond.fetch(bondPda);
    expect(bond.slashed).to.equal(false);
    expect(bond.amount.toNumber()).to.equal(5_000_000);
  });

  it("Capability request without bond rejected — BondNotSatisfied", async () => {
    // Register a new agent without a bond
    const newAgentKeypair = Keypair.generate();
    const newAgentId = newAgentKeypair.publicKey.toBytes();
    const [newAgentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), Buffer.from(newAgentId)], program.programId
    );
    await program.methods.registerAgent(Array.from(newAgentId)).accounts({
      agent: newAgentPda, authority: authority.publicKey, systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    const tp = Keypair.generate().publicKey;
    const ta = Keypair.generate().publicKey;
    const epoch = new BN(1);
    const [capPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("capability"), Buffer.from(newAgentId), epoch.toArrayLike(Buffer, "le", 8), tp.toBuffer()], program.programId
    );
    try {
      await program.methods.requestCapability({
        capabilityType: { payService: {} }, targetProgram: tp, targetAccount: ta,
        amountLimit: new BN(5_000_000), frequencyLimit: new BN(10), ttlSeconds: new BN(3600),
      }).accounts({
        agent: newAgentPda, policy: policyPda, capability: capPda,
        authorityRoot: authority.publicKey, systemProgram: SystemProgram.programId,
      }).signers([authority]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("BondNotSatisfied");
    }
  });
});
