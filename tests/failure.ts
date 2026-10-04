/**
 * Test suite: Failure handling
 *
 * Tests:
 * - Ordinary failure does not downgrade
 * - Critical failure triggers downgrade + slash + epoch++
 * - Critical failure count increments
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { airdrop, makeId, BOND_AMOUNT } from "./helpers";

describe("failure", () => {
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

  async function recordOutcome(result: any, severity: any) {
    const actionId = makeId();
    const capabilityId = makeId();
    const evidenceHash = makeId();
    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), Buffer.from(agentId), Buffer.from(actionId)], program.programId
    );
    await program.methods.recordOutcome(
      Array.from(actionId), Array.from(capabilityId), result, severity, Array.from(evidenceHash)
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
    for (let i = 0; i < 32; i++) verifierId[i] = i + 70;
    try { await program.methods.registerVerifier(Array.from(verifierId), program.programId, verifierOperator.publicKey).accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await program.methods.registerAgent(Array.from(agentId)).accounts({ agent: agentPda, authority: authority.publicKey, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
    try { await program.methods.createPolicy({ versionTag: "PAY-V1", capabilityType: { payService: {} }, minSuccesses: new BN(20), minSuccessRateBps: 9500, criticalFailureLimit: new BN(0), minBondUsdc: new BN(5_000_000), maxAmountUsdc: new BN(500_000_000) }).accounts({ policy: policyPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await program.methods.lockBond(BOND_AMOUNT).accounts({ agent: agentPda, bond: bondPda, authorityRoot: authority.publicKey, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
  });

  it("Ordinary failure does not downgrade tier or slash bond", async () => {
    const before = await program.account.agent.fetch(agentPda);
    await recordOutcome({ fail: {} }, { ordinary: {} });
    const after = await program.account.agent.fetch(agentPda);
    expect(after.tier).to.deep.equal(before.tier);
    expect(after.bondAmount.toNumber()).to.equal(before.bondAmount.toNumber());
    expect(after.currentEpoch.toNumber()).to.equal(before.currentEpoch.toNumber());
    expect(after.totalCount.toNumber()).to.equal(before.totalCount.toNumber() + 1);
  });

  it("Critical failure downgrades to Probation and slashes bond", async () => {
    await recordOutcome({ fail: {} }, { critical: {} });
    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.tier).to.deep.equal({ probation: {} });
    expect(agent.bondAmount.toNumber()).to.equal(0);
    expect(agent.criticalFailures.toNumber()).to.equal(1);
    expect(agent.currentEpoch.toNumber()).to.be.greaterThan(1);

    const bond = await program.account.bond.fetch(bondPda);
    expect(bond.slashed).to.equal(true);
    expect(bond.amount.toNumber()).to.equal(0);
  });
});
