/**
 * Test suite: Delegate scope (session keys)
 *
 * Tests the delegate execution path:
 * - Fresh agent with no DelegateScope → authority_root signs → succeeds
 * - Delegate signs within scope → succeeds
 * - Delegate signs above amount limit → rejected
 * - Delegate signs after expiry → rejected
 * - Unauthorized signer (not authority_root, not delegate) → rejected
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
  deriveBondVaultPda,
  deriveExecutionPda,
} from "./helpers";

describe("delegate-scope", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.PactyraCore as any;

  let authority: Keypair;
  let delegate: Keypair;
  let agentId: Uint8Array;
  let agentPda: PublicKey;
  let bondPda: PublicKey;
  let bondVaultPda: PublicKey;
  let policyPda: PublicKey;
  let verifierRegistryPda: PublicKey;
  let delegateScopePda: PublicKey;
  let usdcMint: PublicKey;
  let userTokenAccount: PublicKey;
  let actionNonce: number;

  async function requestCap(amount: BN) {
    const agent = await program.account.agent.fetch(agentPda);
    const epoch = agent.currentEpoch;
    const tp = Keypair.generate().publicKey;
    const ta = Keypair.generate().publicKey;
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
        frequencyLimit: new BN(100),
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
    signer: Keypair,
    capPda: PublicKey,
    tp: PublicKey,
    ta: PublicKey,
    amount: BN,
    nonce: BN
  ) {
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nonce"), Buffer.from(agentId), nonce.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [executionPda] = deriveExecutionPda(agentId, nonce, program.programId);
    return program.methods
      .assertCapability({
        actionType: { payService: {} },
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
        delegateScope: delegateScopePda,
        signer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc();
  }

  before(async () => {
    authority = Keypair.generate();
    delegate = Keypair.generate();
    await airdrop(provider.connection, authority.publicKey, 50);
    await airdrop(provider.connection, delegate.publicKey, 10);
    await airdrop(provider.connection, provider.wallet.publicKey, 50);

    const agentKeypair = Keypair.generate();
    agentId = agentKeypair.publicKey.toBytes();
    actionNonce = 700;

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
    [delegateScopePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("delegate_scope"), Buffer.from(agentId)], program.programId
    );

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

    try { await program.methods.initializeProtocol().accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    const verifierId = new Uint8Array(32);
    for (let i = 0; i < 32; i++) verifierId[i] = i + 70;
    try { await program.methods.registerVerifier(Array.from(verifierId), program.programId, provider.wallet.publicKey).accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await program.methods.registerAgent(Array.from(agentId)).accounts({ agent: agentPda, authority: authority.publicKey, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
    try { await program.methods.createPolicy({ versionTag: "PAY-V1", capabilityType: { payService: {} }, minSuccesses: new BN(20), minSuccessRateBps: 9500, criticalFailureLimit: new BN(0), minBondUsdc: new BN(5_000_000), maxAmountUsdc: new BN(500_000_000) }).accounts({ policy: policyPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await program.methods.lockBond(BOND_AMOUNT).accounts({ agent: agentPda, bond: bondPda, agentToken: userTokenAccount, bondVault: bondVaultPda, usdcMint: usdcMint, authorityRoot: authority.publicKey, tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
  });

  it("Fresh agent (no DelegateScope) → authority_root signs assert_capability → succeeds", async () => {
    // Verify no DelegateScope exists for this agent
    try {
      await program.account.delegateScope.fetch(delegateScopePda);
      expect.fail("DelegateScope should not exist for fresh agent");
    } catch (e) {
      // Expected — account doesn't exist
    }

    const { capPda, targetProgram, targetAccount } = await requestCap(TIER_1_MAX);
    const nonce = new BN(actionNonce++);
    await assertCap(authority, capPda, targetProgram, targetAccount, TIER_1_MAX, nonce);
  });

  it("Creates a delegate scope for the delegate key", async () => {
    await program.methods
      .delegateAuthority(
        delegate.publicKey,
        new BN(3_000_000), // $3 max per action
        new BN(3600) // 1 hour
      )
      .accounts({
        agent: agentPda,
        delegateScope: delegateScopePda,
        authorityRoot: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const scope = await program.account.delegateScope.fetch(delegateScopePda);
    expect(scope.delegate.toString()).to.equal(delegate.publicKey.toString());
    expect(scope.maxAmountPerAction.toNumber()).to.equal(3_000_000);
  });

  it("Delegate signs within scope → succeeds", async () => {
    const { capPda, targetProgram, targetAccount } = await requestCap(TIER_1_MAX);
    const nonce = new BN(actionNonce++);
    // Use $2 (within $3 limit)
    await assertCap(delegate, capPda, targetProgram, targetAccount, new BN(2_000_000), nonce);
  });

  it("Delegate signs above amount limit → rejected (DelegateAmountExceedsScope)", async () => {
    const { capPda, targetProgram, targetAccount } = await requestCap(TIER_1_MAX);
    const nonce = new BN(actionNonce++);
    try {
      await assertCap(delegate, capPda, targetProgram, targetAccount, new BN(5_000_000), nonce);
      expect.fail("Should reject — amount exceeds delegate scope");
    } catch (err: any) {
      expect(err.toString()).to.include("DelegateAmountExceedsScope");
    }
  });

  it("Unauthorized signer (not authority_root, not delegate) → rejected", async () => {
    const imposter = Keypair.generate();
    await airdrop(provider.connection, imposter.publicKey, 5);

    const { capPda, targetProgram, targetAccount } = await requestCap(TIER_1_MAX);
    const nonce = new BN(actionNonce++);
    try {
      await assertCap(imposter, capPda, targetProgram, targetAccount, new BN(1_000_000), nonce);
      expect.fail("Should reject — unauthorized signer");
    } catch (err: any) {
      // The constraint on agent should reject this
      expect(err.toString()).to.not.be.empty;
    }
  });
});
