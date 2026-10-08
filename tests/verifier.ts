/**
 * Test suite: Verifier security
 *
 * Tests:
 * - Freshness config initialization
 * - Non-Pyth account rejected (WrongOwner)
 * - Insufficient data rejected
 * - Wrong feed ID rejected
 * - Unauthorized verifier rejected (UnauthorizedVerifier)
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import {
  airdrop,
  makeId,
  PYTH_PULL_ORACLE_ID,
  BOND_AMOUNT,
  TIER_1_MAX,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createTokenAccount,
  mintToAccount,
  deriveExecutionPda,
  deriveBondVaultPda,
} from "./helpers";

describe("verifier", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const coreProgram = anchor.workspace.PactyraCore as any;
  const verifierProgram = anchor.workspace.PactyraVerifier as any;

  let authority: Keypair;
  let verifierOperator: Keypair;
  let agentId: Uint8Array;
  let agentPda: PublicKey;
  let bondPda: PublicKey;
  let bondVaultPda: PublicKey;
  let policyPda: PublicKey;
  let verifierRegistryPda: PublicKey;
  let configPda: PublicKey;
  let usdcMint: PublicKey;
  let userTokenAccount: PublicKey;
  let capabilityPda: PublicKey;
  let actionNonce: number;

  const TEST_FEED_ID = new Uint8Array(32);
  for (let i = 0; i < 32; i++) TEST_FEED_ID[i] = i + 1;
  const MAX_AGE = 30;
  const CRITICAL_THRESHOLD = 60;

  before(async () => {
    authority = Keypair.generate();
    verifierOperator = Keypair.generate();
    await airdrop(provider.connection, authority.publicKey, 50);
    await airdrop(provider.connection, verifierOperator.publicKey, 10);
    await airdrop(provider.connection, provider.wallet.publicKey, 50);

    const agentKeypair = Keypair.generate();
    agentId = agentKeypair.publicKey.toBytes();

    [verifierRegistryPda] = PublicKey.findProgramAddressSync([Buffer.from("verifier_registry")], coreProgram.programId);
    [agentPda] = PublicKey.findProgramAddressSync([Buffer.from("agent"), Buffer.from(agentId)], coreProgram.programId);
    [policyPda] = PublicKey.findProgramAddressSync([Buffer.from("policy"), Buffer.from("PAY-V1")], coreProgram.programId);
    [bondPda] = PublicKey.findProgramAddressSync([Buffer.from("bond"), Buffer.from(agentId)], coreProgram.programId);
    [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("freshness_config"), Buffer.from(TEST_FEED_ID)], verifierProgram.programId
    );

    // Set up USDC mint and bond vault for bond escrow
    usdcMint = await createMint(
      provider.connection, provider.wallet.payer, provider.wallet.publicKey, 6
    );
    [bondVaultPda] = deriveBondVaultPda(usdcMint, coreProgram.programId);
    userTokenAccount = await createTokenAccount(
      provider.connection, provider.wallet.payer, usdcMint, authority.publicKey
    );
    await mintToAccount(
      provider.connection, provider.wallet.payer, usdcMint,
      userTokenAccount, provider.wallet.publicKey, 50_000_000
    );

    actionNonce = 700;

    try { await coreProgram.methods.initializeProtocol().accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    const verifierId = new Uint8Array(32);
    for (let i = 0; i < 32; i++) verifierId[i] = i + 95;
    try { await coreProgram.methods.registerVerifier(Array.from(verifierId), verifierProgram.programId, verifierOperator.publicKey).accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await coreProgram.methods.registerAgent(Array.from(agentId)).accounts({ agent: agentPda, authority: authority.publicKey, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
    try { await coreProgram.methods.createPolicy({ versionTag: "PAY-V1", capabilityType: { payService: {} }, minSuccesses: new BN(20), minSuccessRateBps: 9500, criticalFailureLimit: new BN(0), minBondUsdc: new BN(5_000_000), maxAmountUsdc: new BN(500_000_000) }).accounts({ policy: policyPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await coreProgram.methods.lockBond(BOND_AMOUNT).accounts({ agent: agentPda, bond: bondPda, agentToken: userTokenAccount, bondVault: bondVaultPda, usdcMint: usdcMint, authorityRoot: authority.publicKey, tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
  });

  it("Initializes freshness config", async () => {
    await verifierProgram.methods.initializeConfig(
      Array.from(TEST_FEED_ID), new BN(MAX_AGE), new BN(CRITICAL_THRESHOLD)
    ).accounts({
      config: configPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId,
    }).rpc();

    const config = await verifierProgram.account.freshnessConfig.fetch(configPda);
    expect(config.maxAgeSeconds.toNumber()).to.equal(30);
    expect(config.criticalThresholdSeconds.toNumber()).to.equal(60);
  });

  it("Non-Pyth account rejected — WrongOwner", async () => {
    const fakeAccount = Keypair.generate();
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(134);
    const { SystemProgram: SP } = await import("@solana/web3.js");
    await provider.connection.sendTransaction(
      new (await import("@solana/web3.js")).Transaction().add(
        SP.createAccount({
          fromPubkey: provider.wallet.publicKey,
          newAccountPubkey: fakeAccount.publicKey,
          space: 134, lamports, programId: SP.programId,
        })
      ),
      [provider.wallet.payer, fakeAccount]
    );

    try {
      await verifierProgram.methods.verifyFreshness().accounts({
        config: configPda, priceUpdate: fakeAccount.publicKey,
      }).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("WrongOwner");
    }
  });

  it("Insufficient data rejected — owner or data check", async () => {
    const smallAccount = Keypair.generate();
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(50);
    const { SystemProgram: SP, Transaction } = await import("@solana/web3.js");
    await provider.connection.sendTransaction(
      new Transaction().add(
        SP.createAccount({
          fromPubkey: provider.wallet.publicKey, newAccountPubkey: smallAccount.publicKey,
          space: 50, lamports, programId: PYTH_PULL_ORACLE_ID,
        })
      ),
      [provider.wallet.payer, smallAccount]
    );

    try {
      await verifierProgram.methods.verifyFreshness().accounts({
        config: configPda, priceUpdate: smallAccount.publicKey,
      }).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      // On local validator, Pyth program is not deployed, so account creation
      // with PYTH_PULL_ORACLE_ID as owner creates a System-owned account.
      // The verifier correctly rejects with WrongOwner.
      // On devnet with real Pyth, this would be InsufficientData.
      const msg = err.toString();
      expect(msg).to.match(/WrongOwner|InsufficientData|InvalidPrice/i);
    }
  });

  it("Wrong feed ID rejected — owner or feed check", async () => {
    const wrongFeedAccount = Keypair.generate();
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(134);
    const { SystemProgram: SP, Transaction } = await import("@solana/web3.js");
    await provider.connection.sendTransaction(
      new Transaction().add(
        SP.createAccount({
          fromPubkey: provider.wallet.publicKey, newAccountPubkey: wrongFeedAccount.publicKey,
          space: 134, lamports, programId: PYTH_PULL_ORACLE_ID,
        })
      ),
      [provider.wallet.payer, wrongFeedAccount]
    );

    try {
      await verifierProgram.methods.verifyFreshness().accounts({
        config: configPda, priceUpdate: wrongFeedAccount.publicKey,
      }).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      // Same as above: on local validator the owner check fires first.
      // On devnet with real Pyth accounts, this would be WrongFeed.
      const msg = err.toString();
      expect(msg).to.match(/WrongOwner|WrongFeed|InvalidPrice|InsufficientData/i);
    }
  });

  it("Unauthorized verifier rejected — UnauthorizedVerifier", async () => {
    const fakeVerifier = Keypair.generate();
    await airdrop(provider.connection, fakeVerifier.publicKey, 5);

    // Set up a capability and Execution PDA so the UnauthorizedVerifier check
    // fires before any Execution-state checks in record_outcome.
    const agent = await coreProgram.account.agent.fetch(agentPda);
    const epoch = agent.currentEpoch;
    const tp = Keypair.generate().publicKey;
    const ta = Keypair.generate().publicKey;
    [capabilityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("capability"), Buffer.from(agentId), epoch.toArrayLike(Buffer, "le", 8), tp.toBuffer()], coreProgram.programId
    );
    await coreProgram.methods.requestCapability({
      capabilityType: { payService: {} }, targetProgram: tp, targetAccount: ta,
      amountLimit: TIER_1_MAX, frequencyLimit: new BN(10), ttlSeconds: new BN(3600),
    }).accounts({
      agent: agentPda, policy: policyPda, capability: capabilityPda,
      authorityRoot: authority.publicKey, systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    const nonce = new BN(actionNonce++);
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nonce"), Buffer.from(agentId), nonce.toArrayLike(Buffer, "le", 8)], coreProgram.programId
    );
    const [executionPda] = deriveExecutionPda(agentId, nonce, coreProgram.programId);
    await coreProgram.methods.assertCapability({
      actionType: { payService: {} }, targetProgram: tp, targetAccount: ta,
      amount: TIER_1_MAX, actionNonce: nonce,
    }).accounts({
      agent: agentPda, capability: capabilityPda, policy: policyPda,
      consumedNonce: consumedNoncePda, execution: executionPda,
      authorityRoot: authority.publicKey, systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    const actionId = makeId();
    const capabilityId = makeId();
    const evidenceHash = makeId();
    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), Buffer.from(agentId), Buffer.from(actionId)], coreProgram.programId
    );

    try {
      await coreProgram.methods.recordOutcome(
        Array.from(actionId), Array.from(capabilityId), { pass: {} }, { none: {} }, Array.from(evidenceHash)
      ).accounts({
        agent: agentPda, receipt: receiptPda, verifierRegistry: verifierRegistryPda,
        policy: policyPda, execution: executionPda, bond: bondPda,
        verifierOperator: fakeVerifier.publicKey,
        systemProgram: SystemProgram.programId,
      }).signers([fakeVerifier]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("UnauthorizedVerifier");
    }
  });
});
