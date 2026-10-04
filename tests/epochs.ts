/**
 * Test suite: Epoch and authority transitions
 *
 * Tests:
 * - T1 → T2 after 5 successes
 * - T2 → T3 after 20+ successes at 95% rate
 * - T3 → T1 on critical failure
 * - Epoch increments invalidate old capabilities
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { airdrop, makeId, BOND_AMOUNT } from "./helpers";

describe("epochs", () => {
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
  let oldCapabilityPda: PublicKey;

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

  async function requestCap(amount: BN) {
    const agent = await program.account.agent.fetch(agentPda);
    const epoch = agent.currentEpoch;
    const tp = Keypair.generate().publicKey;
    const ta = Keypair.generate().publicKey;
    const [capPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("capability"), Buffer.from(agentId), epoch.toArrayLike(Buffer, "le", 8), tp.toBuffer()],
      program.programId
    );
    await program.methods.requestCapability({
      capabilityType: { payService: {} }, targetProgram: tp, targetAccount: ta,
      amountLimit: amount, frequencyLimit: new BN(10), ttlSeconds: new BN(3600),
    }).accounts({
      agent: agentPda, policy: policyPda, capability: capPda,
      authorityRoot: authority.publicKey, systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();
    return capPda;
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
    for (let i = 0; i < 32; i++) verifierId[i] = i + 40;
    try { await program.methods.registerVerifier(Array.from(verifierId), program.programId, verifierOperator.publicKey).accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await program.methods.registerAgent(Array.from(agentId)).accounts({ agent: agentPda, authority: authority.publicKey, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
    try { await program.methods.createPolicy({ versionTag: "PAY-V1", capabilityType: { payService: {} }, minSuccesses: new BN(20), minSuccessRateBps: 9500, criticalFailureLimit: new BN(0), minBondUsdc: new BN(5_000_000), maxAmountUsdc: new BN(500_000_000) }).accounts({ policy: policyPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await program.methods.lockBond(BOND_AMOUNT).accounts({ agent: agentPda, bond: bondPda, authorityRoot: authority.publicKey, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
  });

  it("T1 → T2 after 5 verified successes", async () => {
    for (let i = 0; i < 5; i++) await recordOutcome({ pass: {} }, { none: {} });
    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.tier).to.deep.equal({ proven: {} });
  });

  it("T2 → T3 after 22 more successes + 1 ordinary fail (27/28 = 96.4%)", async () => {
    for (let i = 0; i < 22; i++) await recordOutcome({ pass: {} }, { none: {} });
    await recordOutcome({ fail: {} }, { ordinary: {} });
    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.tier).to.deep.equal({ trusted: {} });
    expect(agent.successCount.toNumber()).to.equal(27);
    expect(agent.totalCount.toNumber()).to.equal(28);
  });

  it("T3 → T1 on critical failure with epoch increment", async () => {
    oldCapabilityPda = await requestCap(new BN(500_000_000));
    await recordOutcome({ fail: {} }, { critical: {} });
    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.tier).to.deep.equal({ probation: {} });
    expect(agent.currentEpoch.toNumber()).to.equal(2);
    expect(agent.bondAmount.toNumber()).to.equal(0);
  });

  it("Old epoch capability rejected — StaleEpoch", async () => {
    const cap = await program.account.capability.fetch(oldCapabilityPda);
    expect(cap.authorityEpoch.toNumber()).to.equal(1);
    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.currentEpoch.toNumber()).to.equal(2);

    const nonce = new BN(999);
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nonce"), Buffer.from(agentId), nonce.toArrayLike(Buffer, "le", 8)], program.programId
    );
    try {
      await program.methods.assertCapability({
        actionType: { payService: {} }, targetProgram: cap.targetProgram,
        targetAccount: cap.targetAccount, amount: new BN(1_000_000), actionNonce: nonce,
      }).accounts({
        agent: agentPda, capability: oldCapabilityPda, policy: policyPda,
        consumedNonce: consumedNoncePda, authorityRoot: authority.publicKey,
        systemProgram: SystemProgram.programId,
      }).signers([authority]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("StaleEpoch");
    }
  });
});
