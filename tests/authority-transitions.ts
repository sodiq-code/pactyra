import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { expect } from "chai";

describe("pactyra-core authority transitions", () => {
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
  let verifierId: Uint8Array;
  let capabilityPda: PublicKey;
  let oldCapabilityPda: PublicKey;

  const TIER_1_MAX = new BN(5_000_000);
  const TIER_2_MAX = new BN(50_000_000);
  const TIER_3_MAX = new BN(500_000_000);
  const BOND_AMOUNT = new BN(5_000_000);

  let receiptCounter = 0;

  async function airdrop(pubkey: PublicKey, amount: number) {
    const sig = await provider.connection.requestAirdrop(
      pubkey,
      amount * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig, "confirmed");
  }

  function makeId(seed: string): Uint8Array {
    const kp = Keypair.generate();
    return kp.publicKey.toBytes();
  }

  async function recordOutcome(
    result: any,
    severity: any,
    actionIdSeed: string
  ) {
    const actionId = makeId(actionIdSeed);
    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), Buffer.from(agentId), Buffer.from(actionId)],
      program.programId
    );

    await program.methods
      .recordOutcome(
        Array.from(actionId),
        Array.from(actionId),
        result,
        severity,
        Array.from(makeId("evidence"))
      )
      .accounts({
        agent: agentPda,
        receipt: receiptPda,
        verifierRegistry: verifierRegistryPda,
        policy: policyPda,
        bond: bondPda,
        verifierOperator: verifierOperator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([verifierOperator])
      .rpc();

    receiptCounter++;
    return { actionId, receiptPda };
  }

  async function requestCapabilityAt(amount: BN) {
    const agent = await program.account.agent.fetch(agentPda);
    const epoch = agent.currentEpoch;
    const targetProgram = Keypair.generate().publicKey;
    const targetAccount = Keypair.generate().publicKey;

    const [capPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("capability"),
        Buffer.from(agentId),
        epoch.toArrayLike(Buffer, "le", 8),
        targetProgram.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .requestCapability({
        capabilityType: { payService: {} },
        targetProgram,
        targetAccount,
        amountLimit: amount,
        frequencyLimit: new BN(10),
        ttlSeconds: new BN(3600),
      })
      .accounts({
        agent: agentPda,
        policy: policyPda,
        capability: capPda,
        authorityRoot: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    return capPda;
  }

  before(async () => {
    authority = Keypair.generate();
    verifierOperator = Keypair.generate();
    await airdrop(authority.publicKey, 50);
    await airdrop(verifierOperator.publicKey, 10);
    await airdrop(provider.wallet.publicKey, 50);

    const agentKeypair = Keypair.generate();
    agentId = agentKeypair.publicKey.toBytes();
    verifierId = makeId("verifier");

    [verifierRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("verifier_registry")],
      program.programId
    );
    [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), Buffer.from(agentId)],
      program.programId
    );
    [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), Buffer.from("PAY-V1")],
      program.programId
    );
    [bondPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bond"), Buffer.from(agentId)],
      program.programId
    );
  });

  it("Initializes the protocol", async () => {
    await program.methods
      .initializeProtocol()
      .accounts({
        verifierRegistry: verifierRegistryPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("Registers a verifier operator", async () => {
    await program.methods
      .registerVerifier(
        Array.from(verifierId),
        program.programId,
        verifierOperator.publicKey
      )
      .accounts({
        verifierRegistry: verifierRegistryPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const registry = await program.account.verifierRegistry.fetch(
      verifierRegistryPda
    );
    expect(registry.verifiers).to.have.length(1);
    expect(registry.verifiers[0].operatorKey.toString()).to.equal(
      verifierOperator.publicKey.toString()
    );
    expect(registry.verifiers[0].active).to.equal(true);
  });

  it("Registers an agent at Tier 1 (Probation)", async () => {
    await program.methods
      .registerAgent(Array.from(agentId))
      .accounts({
        agent: agentPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.tier).to.deep.equal({ probation: {} });
    expect(agent.currentEpoch.toNumber()).to.equal(1);
  });

  it("Creates a policy", async () => {
    await program.methods
      .createPolicy({
        versionTag: "PAY-V1",
        capabilityType: { payService: {} },
        minSuccesses: new BN(20),
        minSuccessRateBps: 9500,
        criticalFailureLimit: new BN(0),
        minBondUsdc: new BN(5_000_000),
        maxAmountUsdc: new BN(500_000_000),
      })
      .accounts({
        policy: policyPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("Locks a 5 USDC bond", async () => {
    await program.methods
      .lockBond(BOND_AMOUNT)
      .accounts({
        agent: agentPda,
        bond: bondPda,
        authorityRoot: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.bondAmount.toNumber()).to.equal(5_000_000);
  });

  it("Rejects $50 capability request at Tier 1 — AmountExceedsTier", async () => {
    try {
      await requestCapabilityAt(TIER_2_MAX);
      expect.fail("Should have rejected $50 at Tier 1");
    } catch (err: any) {
      expect(err.toString()).to.include("AmountExceedsTier");
    }
  });

  it("Accepts $5 capability request at Tier 1", async () => {
    capabilityPda = await requestCapabilityAt(TIER_1_MAX);
    const cap = await program.account.capability.fetch(capabilityPda);
    expect(cap.amountLimit.toNumber()).to.equal(5_000_000);
  });

  // ========================================
  // T1 → T2: 5 verified successes
  // ========================================

  it("Records 5 successful outcomes — upgrades to Tier 2 (Proven)", async () => {
    for (let i = 0; i < 5; i++) {
      await recordOutcome(
        { pass: {} },
        { none: {} },
        `success-${i}`
      );
    }

    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.successCount.toNumber()).to.equal(5);
    expect(agent.totalCount.toNumber()).to.equal(5);
    expect(agent.tier).to.deep.equal({ proven: {} });
    expect(agent.currentEpoch.toNumber()).to.equal(1);
  });

  it("Accepts $50 capability request at Tier 2", async () => {
    capabilityPda = await requestCapabilityAt(TIER_2_MAX);
    const cap = await program.account.capability.fetch(capabilityPda);
    expect(cap.amountLimit.toNumber()).to.equal(50_000_000);
  });

  it("Rejects $500 capability request at Tier 2 — AmountExceedsTier", async () => {
    try {
      await requestCapabilityAt(TIER_3_MAX);
      expect.fail("Should have rejected $500 at Tier 2");
    } catch (err: any) {
      expect(err.toString()).to.include("AmountExceedsTier");
    }
  });

  // ========================================
  // T2 → T3: 22 more successes (27/28 total = 96.4%)
  // ========================================

  it("Records 22 more successes + 1 ordinary fail (27/28 = 96.4%) — upgrades to Tier 3 (Trusted)", async () => {
    for (let i = 0; i < 22; i++) {
      await recordOutcome({ pass: {} }, { none: {} }, `tier3-success-${i}`);
    }

    await recordOutcome({ fail: {} }, { ordinary: {} }, `tier3-fail-0`);

    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.successCount.toNumber()).to.equal(27);
    expect(agent.totalCount.toNumber()).to.equal(28);
    expect(agent.criticalFailures.toNumber()).to.equal(0);

    const successRate = (27 * 10000) / 28;
    expect(successRate).to.be.at.least(9500);

    expect(agent.tier).to.deep.equal({ trusted: {} });
    expect(agent.currentEpoch.toNumber()).to.equal(1);
  });

  it("Accepts $500 capability request at Tier 3", async () => {
    capabilityPda = await requestCapabilityAt(TIER_3_MAX);
    const cap = await program.account.capability.fetch(capabilityPda);
    expect(cap.amountLimit.toNumber()).to.equal(500_000_000);
    expect(cap.authorityEpoch.toNumber()).to.equal(1);
  });

  // ========================================
  // T3 → T1: Critical failure
  // ========================================

  it("Records a critical failure — downgrades to Tier 1, slashes bond, increments epoch", async () => {
    oldCapabilityPda = capabilityPda;

    await recordOutcome(
      { fail: {} },
      { critical: {} },
      "critical-failure"
    );

    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.tier).to.deep.equal({ probation: {} });
    expect(agent.currentEpoch.toNumber()).to.equal(2);
    expect(agent.bondAmount.toNumber()).to.equal(0);
    expect(agent.criticalFailures.toNumber()).to.equal(1);

    const bond = await program.account.bond.fetch(bondPda);
    expect(bond.slashed).to.equal(true);
    expect(bond.amount.toNumber()).to.equal(0);
  });

  it("Rejects old capability (stale epoch) — StaleEpoch", async () => {
    const cap = await program.account.capability.fetch(oldCapabilityPda);
    expect(cap.authorityEpoch.toNumber()).to.equal(1);

    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.currentEpoch.toNumber()).to.equal(2);

    const nonce = new BN(999);
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("nonce"),
        Buffer.from(agentId),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .assertCapability({
          actionType: { payService: {} },
          targetProgram: cap.targetProgram,
          targetAccount: cap.targetAccount,
          amount: new BN(1_000_000),
          actionNonce: nonce,
        })
        .accounts({
          agent: agentPda,
          capability: oldCapabilityPda,
          policy: policyPda,
          consumedNonce: consumedNoncePda,
          authorityRoot: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      expect.fail("Should have rejected stale epoch capability");
    } catch (err: any) {
      expect(err.toString()).to.include("StaleEpoch");
    }
  });

  it("Rejects $50 capability at Tier 1 after downgrade — AmountExceedsTier", async () => {
    try {
      await requestCapabilityAt(TIER_2_MAX);
      expect.fail("Should have rejected $50 at Tier 1 after downgrade");
    } catch (err: any) {
      expect(err.toString()).to.include("AmountExceedsTier");
    }
  });

  it("Re-locks bond after slash", async () => {
    await program.methods
      .lockBond(BOND_AMOUNT)
      .accounts({
        agent: agentPda,
        bond: bondPda,
        authorityRoot: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.bondAmount.toNumber()).to.equal(5_000_000);

    const bond = await program.account.bond.fetch(bondPda);
    expect(bond.slashed).to.equal(false);
    expect(bond.amount.toNumber()).to.equal(5_000_000);
  });

  it("Accepts $5 capability at Tier 1 after downgrade", async () => {
    capabilityPda = await requestCapabilityAt(TIER_1_MAX);
    const cap = await program.account.capability.fetch(capabilityPda);
    expect(cap.amountLimit.toNumber()).to.equal(5_000_000);
    expect(cap.authorityEpoch.toNumber()).to.equal(2);
  });

  it("Rejects outcome from unregistered verifier — UnauthorizedVerifier", async () => {
    const fakeVerifier = Keypair.generate();
    await airdrop(fakeVerifier.publicKey, 5);

    const actionId = makeId("unauthorized");
    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), Buffer.from(agentId), Buffer.from(actionId)],
      program.programId
    );

    try {
      await program.methods
        .recordOutcome(
          Array.from(actionId),
          Array.from(actionId),
          { pass: {} },
          { none: {} },
          Array.from(makeId("evidence"))
        )
        .accounts({
          agent: agentPda,
          receipt: receiptPda,
          verifierRegistry: verifierRegistryPda,
          policy: policyPda,
          bond: bondPda,
          verifierOperator: fakeVerifier.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([fakeVerifier])
        .rpc();
      expect.fail("Should have rejected unregistered verifier");
    } catch (err: any) {
      expect(err.toString()).to.include("UnauthorizedVerifier");
    }
  });

  it("Revokes a capability", async () => {
    await program.methods
      .revokeCapability()
      .accounts({
        agent: agentPda,
        capability: capabilityPda,
        authorityRoot: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    const cap = await program.account.capability.fetch(capabilityPda);
    expect(cap.status).to.deep.equal({ revoked: {} });
  });

  it("Rejects assertion of revoked capability — CapabilityNotActive", async () => {
    const cap = await program.account.capability.fetch(capabilityPda);
    const nonce = new BN(998);
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("nonce"),
        Buffer.from(agentId),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .assertCapability({
          actionType: { payService: {} },
          targetProgram: cap.targetProgram,
          targetAccount: cap.targetAccount,
          amount: new BN(1_000_000),
          actionNonce: nonce,
        })
        .accounts({
          agent: agentPda,
          capability: capabilityPda,
          policy: policyPda,
          consumedNonce: consumedNoncePda,
          authorityRoot: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      expect.fail("Should have rejected revoked capability");
    } catch (err: any) {
      expect(err.toString()).to.include("CapabilityNotActive");
    }
  });
});
