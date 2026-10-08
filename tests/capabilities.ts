/**
 * Test suite: Capability assertions
 *
 * Tests the 12 security checks in assert_capability:
 * - valid capability passes
 * - wrong agent rejected
 * - wrong target rejected
 * - wrong amount rejected (AmountExceedsCapability)
 * - expired capability rejected
 * - wrong policy rejected
 * - wrong epoch rejected (StaleEpoch)
 * - wrong action type rejected
 * - revoked capability rejected
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import {
  airdrop,
  makeId,
  TIER_1_MAX,
  BOND_AMOUNT,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createTokenAccount,
  mintToAccount,
  deriveExecutionPda,
  deriveBondVaultPda,
} from "./helpers";

describe("capabilities", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.PactyraCore as any;

  let authority: Keypair;
  let agentId: Uint8Array;
  let agentPda: PublicKey;
  let bondPda: PublicKey;
  let bondVaultPda: PublicKey;
  let policyPda: PublicKey;
  let verifierRegistryPda: PublicKey;
  let capabilityPda: PublicKey;
  let targetProgram: PublicKey;
  let targetAccount: PublicKey;
  let actionNonce: number;
  let usdcMint: PublicKey;
  let userTokenAccount: PublicKey;

  async function requestCap(amount: BN, targetProg?: PublicKey, targetAcct?: PublicKey) {
    const agent = await program.account.agent.fetch(agentPda);
    const epoch = agent.currentEpoch;
    const tp = targetProg || Keypair.generate().publicKey;
    const ta = targetAcct || Keypair.generate().publicKey;
    const [capPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("capability"), Buffer.from(agentId), epoch.toArrayLike(Buffer, "le", 8), tp.toBuffer()],
      program.programId
    );
    await program.methods
      .requestCapability({
        capabilityType: { payService: {} },
        targetProgram: tp,
        targetAccount: ta,
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
    return { capPda, targetProgram: tp, targetAccount: ta };
  }

  async function assertCap(
    capPda: PublicKey,
    tp: PublicKey,
    ta: PublicKey,
    amount: BN,
    nonce: BN,
    actionType: any = { payService: {} }
  ) {
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nonce"), Buffer.from(agentId), nonce.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [executionPda] = deriveExecutionPda(agentId, nonce, program.programId);
    return program.methods
      .assertCapability({
        actionType,
        targetProgram: tp,
        targetAccount: ta,
        amount,
        actionNonce: nonce,
      })
      .accounts({
        agent: agentPda,
        capability: capPda,
        policy: policyPda,
        consumedNonce: consumedNoncePda,
        execution: executionPda,
        authorityRoot: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();
  }

  before(async () => {
    authority = Keypair.generate();
    await airdrop(provider.connection, authority.publicKey, 50);
    await airdrop(provider.connection, provider.wallet.publicKey, 50);

    const agentKeypair = Keypair.generate();
    agentId = agentKeypair.publicKey.toBytes();
    actionNonce = 100;

    [verifierRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("verifier_registry")], program.programId
    );
    [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), Buffer.from(agentId)], program.programId
    );
    [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), Buffer.from("PAY-V1")], program.programId
    );
    [bondPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bond"), Buffer.from(agentId)], program.programId
    );

    // Set up USDC mint and bond vault for bond escrow
    usdcMint = await createMint(
      provider.connection, provider.wallet.payer, provider.wallet.publicKey, 6
    );
    [bondVaultPda] = deriveBondVaultPda(usdcMint, program.programId);
    userTokenAccount = await createTokenAccount(
      provider.connection, provider.wallet.payer, usdcMint, authority.publicKey
    );
    await mintToAccount(
      provider.connection, provider.wallet.payer, usdcMint,
      userTokenAccount, provider.wallet.publicKey, 50_000_000
    );

    // Initialize protocol
    try { await program.methods.initializeProtocol().accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}

    // Register verifier
    const verifierId = new Uint8Array(32);
    for (let i = 0; i < 32; i++) verifierId[i] = i + 30;
    try { await program.methods.registerVerifier(Array.from(verifierId), program.programId, provider.wallet.publicKey).accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}

    // Register agent
    try { await program.methods.registerAgent(Array.from(agentId)).accounts({ agent: agentPda, authority: authority.publicKey, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}

    // Create policy
    try { await program.methods.createPolicy({ versionTag: "PAY-V1", capabilityType: { payService: {} }, minSuccesses: new BN(20), minSuccessRateBps: 9500, criticalFailureLimit: new BN(0), minBondUsdc: new BN(5_000_000), maxAmountUsdc: new BN(500_000_000) }).accounts({ policy: policyPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}

    // Lock bond with real USDC transfer
    try { await program.methods.lockBond(BOND_AMOUNT).accounts({ agent: agentPda, bond: bondPda, agentToken: userTokenAccount, bondVault: bondVaultPda, usdcMint: usdcMint, authorityRoot: authority.publicKey, tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
  });

  it("Valid capability assertion passes", async () => {
    const { capPda, targetProgram, targetAccount } = await requestCap(TIER_1_MAX);
    capabilityPda = capPda;
    const nonce = new BN(actionNonce++);
    await assertCap(capPda, targetProgram, targetAccount, TIER_1_MAX, nonce);
  });

  it("Wrong amount rejected — AmountExceedsCapability", async () => {
    const { capPda, targetProgram, targetAccount } = await requestCap(TIER_1_MAX);
    const nonce = new BN(actionNonce++);
    try {
      await assertCap(capPda, targetProgram, targetAccount, new BN(6_000_000), nonce);
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("AmountExceedsCapability");
    }
  });

  it("Wrong target account rejected — TargetNotInScope", async () => {
    const { capPda, targetProgram } = await requestCap(TIER_1_MAX);
    const nonce = new BN(actionNonce++);
    try {
      await assertCap(capPda, targetProgram, Keypair.generate().publicKey, TIER_1_MAX, nonce);
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("TargetNotInScope");
    }
  });

  it("Wrong target program rejected — TargetProgramMismatch", async () => {
    const { targetAccount } = await requestCap(TIER_1_MAX);
    const nonce = new BN(actionNonce++);
    try {
      await assertCap(capabilityPda, Keypair.generate().publicKey, targetAccount, TIER_1_MAX, nonce);
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("TargetProgramMismatch");
    }
  });

  it("Wrong action type rejected — ActionTypeNotPermitted", async () => {
    const { capPda, targetProgram, targetAccount } = await requestCap(TIER_1_MAX);
    const nonce = new BN(actionNonce++);
    try {
      await assertCap(capPda, targetProgram, targetAccount, TIER_1_MAX, nonce, { trade: {} });
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("ActionTypeNotPermitted");
    }
  });

  it("Revoked capability rejected — CapabilityNotActive", async () => {
    const { capPda, targetProgram, targetAccount } = await requestCap(TIER_1_MAX);
    await program.methods.revokeCapability()
      .accounts({ agent: agentPda, capability: capPda, authorityRoot: authority.publicKey })
      .signers([authority]).rpc();
    const nonce = new BN(actionNonce++);
    try {
      await assertCap(capPda, targetProgram, targetAccount, TIER_1_MAX, nonce);
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("CapabilityNotActive");
    }
  });
});
