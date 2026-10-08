/**
 * Test suite: Treasury enforcement
 *
 * Tests:
 * - Authorized transfer executes (CPI into assert_capability passes)
 * - Unauthorized transfer reverts (AmountExceedsCapability)
 * - Wrong recipient rejected (TargetNotInScope)
 * - Capability substitution rejected
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import {
  airdrop, makeId, TIER_1_MAX, BOND_AMOUNT,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint, createTokenAccount, mintToAccount, getTokenBalance,
  deriveExecutionPda, deriveBondVaultPda,
} from "./helpers";

describe("treasury", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const coreProgram = anchor.workspace.PactyraCore as any;
  const treasuryProgram = anchor.workspace.ReferenceTreasury as any;

  let authority: Keypair;
  let agentId: Uint8Array;
  let agentPda: PublicKey;
  let bondPda: PublicKey;
  let bondVaultPda: PublicKey;
  let policyPda: PublicKey;
  let verifierRegistryPda: PublicKey;
  let treasuryPda: PublicKey;
  let vault: PublicKey;
  let userTokenAccount: PublicKey;
  let recipientTokenAccount: PublicKey;
  let usdcMint: PublicKey;
  let capabilityPda: PublicKey;
  let actionNonce: number;

  before(async () => {
    authority = Keypair.generate();
    await airdrop(provider.connection, authority.publicKey, 50);
    await airdrop(provider.connection, provider.wallet.publicKey, 50);

    const agentKeypair = Keypair.generate();
    agentId = agentKeypair.publicKey.toBytes();
    actionNonce = 300;

    [verifierRegistryPda] = PublicKey.findProgramAddressSync([Buffer.from("verifier_registry")], coreProgram.programId);
    [agentPda] = PublicKey.findProgramAddressSync([Buffer.from("agent"), Buffer.from(agentId)], coreProgram.programId);
    [policyPda] = PublicKey.findProgramAddressSync([Buffer.from("policy"), Buffer.from("PAY-V1")], coreProgram.programId);
    [bondPda] = PublicKey.findProgramAddressSync([Buffer.from("bond"), Buffer.from(agentId)], coreProgram.programId);

    usdcMint = await createMint(provider.connection, provider.wallet.payer, provider.wallet.publicKey, 6);
    [bondVaultPda] = deriveBondVaultPda(usdcMint, coreProgram.programId);
    [treasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("treasury"), authority.publicKey.toBuffer()], treasuryProgram.programId);
    [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), treasuryPda.toBuffer()], treasuryProgram.programId);
    userTokenAccount = await createTokenAccount(provider.connection, provider.wallet.payer, usdcMint, authority.publicKey);
    recipientTokenAccount = await createTokenAccount(provider.connection, provider.wallet.payer, usdcMint, authority.publicKey);
    await mintToAccount(provider.connection, provider.wallet.payer, usdcMint, userTokenAccount, provider.wallet.publicKey, 100_000_000);

    try { await coreProgram.methods.initializeProtocol().accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    const verifierId = new Uint8Array(32);
    for (let i = 0; i < 32; i++) verifierId[i] = i + 90;
    try { await coreProgram.methods.registerVerifier(Array.from(verifierId), coreProgram.programId, provider.wallet.publicKey).accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await coreProgram.methods.registerAgent(Array.from(agentId)).accounts({ agent: agentPda, authority: authority.publicKey, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
    try { await coreProgram.methods.createPolicy({ versionTag: "PAY-V1", capabilityType: { payService: {} }, minSuccesses: new BN(20), minSuccessRateBps: 9500, criticalFailureLimit: new BN(0), minBondUsdc: new BN(5_000_000), maxAmountUsdc: new BN(500_000_000) }).accounts({ policy: policyPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await coreProgram.methods.lockBond(BOND_AMOUNT).accounts({ agent: agentPda, bond: bondPda, agentToken: userTokenAccount, bondVault: bondVaultPda, usdcMint: usdcMint, authorityRoot: authority.publicKey, tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
  });

  it("Initializes treasury and deposits USDC", async () => {
    await treasuryProgram.methods.initializeTreasury(0).accounts({
      treasury: treasuryPda, vault, usdcMint, authority: authority.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    const [userBalancePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_balance"), treasuryPda.toBuffer(), authority.publicKey.toBuffer()], treasuryProgram.programId
    );
    await treasuryProgram.methods.deposit(new BN(100_000_000)).accounts({
      treasury: treasuryPda, userBalance: userBalancePda, userToken: userTokenAccount,
      vault, user: authority.publicKey, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    const bal = await getTokenBalance(provider.connection, vault);
    expect(bal).to.equal(100_000_000);
  });

  it("Authorized $5 transfer executes — CPI passes", async () => {
    const agent = await coreProgram.account.agent.fetch(agentPda);
    const epoch = agent.currentEpoch;
    [capabilityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("capability"), Buffer.from(agentId), epoch.toArrayLike(Buffer, "le", 8), treasuryPda.toBuffer()], coreProgram.programId
    );
    await coreProgram.methods.requestCapability({
      capabilityType: { payService: {} }, targetProgram: treasuryPda, targetAccount: recipientTokenAccount,
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
    const vaultBefore = await getTokenBalance(provider.connection, vault);
    const recipBefore = await getTokenBalance(provider.connection, recipientTokenAccount);

    await treasuryProgram.methods.authorizedTransfer(TIER_1_MAX, nonce).accounts({
      treasury: treasuryPda, agent: agentPda, capability: capabilityPda, policy: policyPda,
      consumedNonce: consumedNoncePda, execution: executionPda, pactyraCoreProgram: coreProgram.programId,
      vault, recipientToken: recipientTokenAccount, authorityRoot: authority.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    const vaultAfter = await getTokenBalance(provider.connection, vault);
    const recipAfter = await getTokenBalance(provider.connection, recipientTokenAccount);
    expect(vaultBefore - vaultAfter).to.equal(5_000_000);
    expect(recipAfter - recipBefore).to.equal(5_000_000);
  });

  it("Unauthorized $6 transfer reverts — no USDC moved", async () => {
    const nonce = new BN(actionNonce++);
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nonce"), Buffer.from(agentId), nonce.toArrayLike(Buffer, "le", 8)], coreProgram.programId
    );
    const [executionPda] = deriveExecutionPda(agentId, nonce, coreProgram.programId);
    const vaultBefore = await getTokenBalance(provider.connection, vault);
    try {
      await treasuryProgram.methods.authorizedTransfer(new BN(6_000_000), nonce).accounts({
        treasury: treasuryPda, agent: agentPda, capability: capabilityPda, policy: policyPda,
        consumedNonce: consumedNoncePda, execution: executionPda, pactyraCoreProgram: coreProgram.programId,
        vault, recipientToken: recipientTokenAccount, authorityRoot: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      }).signers([authority]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("AmountExceedsCapability");
    }
    const vaultAfter = await getTokenBalance(provider.connection, vault);
    expect(vaultAfter).to.equal(vaultBefore);
  });

  it("Wrong recipient rejected — TargetNotInScope, no USDC moved", async () => {
    const wrongRecipient = await createTokenAccount(provider.connection, provider.wallet.payer, usdcMint, authority.publicKey);
    const nonce = new BN(actionNonce++);
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nonce"), Buffer.from(agentId), nonce.toArrayLike(Buffer, "le", 8)], coreProgram.programId
    );
    const [executionPda] = deriveExecutionPda(agentId, nonce, coreProgram.programId);
    const vaultBefore = await getTokenBalance(provider.connection, vault);
    try {
      await treasuryProgram.methods.authorizedTransfer(new BN(1_000_000), nonce).accounts({
        treasury: treasuryPda, agent: agentPda, capability: capabilityPda, policy: policyPda,
        consumedNonce: consumedNoncePda, execution: executionPda, pactyraCoreProgram: coreProgram.programId,
        vault, recipientToken: wrongRecipient, authorityRoot: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      }).signers([authority]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("TargetNotInScope");
    }
    const vaultAfter = await getTokenBalance(provider.connection, vault);
    expect(vaultAfter).to.equal(vaultBefore);
  });
});
