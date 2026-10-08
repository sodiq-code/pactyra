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
import {
  airdrop,
  makeId,
  BOND_AMOUNT,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createTokenAccount,
  mintToAccount,
  deriveExecutionPda,
  deriveBondVaultPda,
  computeActionId,
} from "./helpers";

describe("epochs", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.PactyraCore as any;
  const treasuryProgram = anchor.workspace.ReferenceTreasury as any;

  let authority: Keypair;
  let verifierOperator: Keypair;
  let agentId: Uint8Array;
  let agentPda: PublicKey;
  let bondPda: PublicKey;
  let bondVaultPda: PublicKey;
  let policyPda: PublicKey;
  let verifierRegistryPda: PublicKey;
  let oldCapabilityPda: PublicKey;
  let usdcMint: PublicKey;
  let userTokenAccount: PublicKey;
  let recipientTokenAccount: PublicKey;
  let treasuryPda: PublicKey;
  let vault: PublicKey;
  let capabilityPda: PublicKey;
  let capabilityId: Uint8Array;
  let actionNonce: number;
  const RECORD_AMOUNT = new BN(1_000_000);

  // Full assert -> execute -> record flow required by the new Execution PDA.
  async function recordOutcome(result: any, severity: any) {
    const nonce = new BN(actionNonce++);
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nonce"), Buffer.from(agentId), nonce.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [executionPda] = deriveExecutionPda(agentId, nonce, program.programId);

    // 1. Assert capability — creates the Execution PDA in Asserted status.
    await program.methods.assertCapability({
      actionType: { payService: {} },
      targetProgram: treasuryPda, targetAccount: recipientTokenAccount,
      amount: RECORD_AMOUNT, actionNonce: nonce,
    }).accounts({
      agent: agentPda, capability: capabilityPda, policy: policyPda,
      consumedNonce: consumedNoncePda, execution: executionPda,
      authorityRoot: authority.publicKey, systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    // 2. Treasury authorized_transfer — CPIs into mark_executed (Asserted → Executed).
    await treasuryProgram.methods.authorizedTransfer(RECORD_AMOUNT, nonce).accounts({
      treasury: treasuryPda, agent: agentPda, capability: capabilityPda, policy: policyPda,
      consumedNonce: consumedNoncePda, execution: executionPda,
      pactyraCoreProgram: program.programId,
      vault, recipientToken: recipientTokenAccount, authorityRoot: authority.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    // 3. Compute the action_id the same way assert_capability did.
    const actionId = computeActionId(
      agentId, capabilityId, 0, treasuryPda, recipientTokenAccount,
      RECORD_AMOUNT, nonce
    );
    const evidenceHash = makeId();
    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), Buffer.from(agentId), Buffer.from(actionId)], program.programId
    );

    // 4. Record the outcome — the Execution PDA is now Executed, so this succeeds.
    await program.methods.recordOutcome(
      Array.from(actionId), Array.from(capabilityId),
      result, severity, Array.from(evidenceHash)
    ).accounts({
      agent: agentPda, receipt: receiptPda, verifierRegistry: verifierRegistryPda,
      policy: policyPda, execution: executionPda, bond: bondPda,
      verifierOperator: verifierOperator.publicKey,
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
    actionNonce = 400;

    [verifierRegistryPda] = PublicKey.findProgramAddressSync([Buffer.from("verifier_registry")], program.programId);
    [agentPda] = PublicKey.findProgramAddressSync([Buffer.from("agent"), Buffer.from(agentId)], program.programId);
    [policyPda] = PublicKey.findProgramAddressSync([Buffer.from("policy"), Buffer.from("PAY-V1")], program.programId);
    [bondPda] = PublicKey.findProgramAddressSync([Buffer.from("bond"), Buffer.from(agentId)], program.programId);

    // Set up USDC mint, bond vault, treasury vault, and token accounts.
    usdcMint = await createMint(
      provider.connection, provider.wallet.payer, provider.wallet.publicKey, 6
    );
    [bondVaultPda] = deriveBondVaultPda(usdcMint, program.programId);
    [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), authority.publicKey.toBuffer()], treasuryProgram.programId
    );
    [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), treasuryPda.toBuffer()], treasuryProgram.programId
    );
    userTokenAccount = await createTokenAccount(
      provider.connection, provider.wallet.payer, usdcMint, authority.publicKey
    );
    recipientTokenAccount = await createTokenAccount(
      provider.connection, provider.wallet.payer, usdcMint, authority.publicKey
    );
    await mintToAccount(
      provider.connection, provider.wallet.payer, usdcMint,
      userTokenAccount, provider.wallet.publicKey, 200_000_000
    );

    try { await program.methods.initializeProtocol().accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    const verifierId = new Uint8Array(32);
    for (let i = 0; i < 32; i++) verifierId[i] = i + 40;
    try { await program.methods.registerVerifier(Array.from(verifierId), program.programId, verifierOperator.publicKey).accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await program.methods.registerAgent(Array.from(agentId)).accounts({ agent: agentPda, authority: authority.publicKey, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
    try { await program.methods.createPolicy({ versionTag: "PAY-V1", capabilityType: { payService: {} }, minSuccesses: new BN(20), minSuccessRateBps: 9500, criticalFailureLimit: new BN(0), minBondUsdc: new BN(5_000_000), maxAmountUsdc: new BN(500_000_000) }).accounts({ policy: policyPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await program.methods.lockBond(BOND_AMOUNT).accounts({ agent: agentPda, bond: bondPda, agentToken: userTokenAccount, bondVault: bondVaultPda, usdcMint: usdcMint, authorityRoot: authority.publicKey, tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}

    // Initialize treasury and deposit USDC for authorized transfers.
    try {
      await treasuryProgram.methods.initializeTreasury(0).accounts({
        treasury: treasuryPda, vault, usdcMint, authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([authority]).rpc();
    } catch (e) {}
    const [userBalancePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_balance"), treasuryPda.toBuffer(), authority.publicKey.toBuffer()],
      treasuryProgram.programId
    );
    try {
      await treasuryProgram.methods.deposit(new BN(100_000_000)).accounts({
        treasury: treasuryPda, userBalance: userBalancePda,
        userToken: userTokenAccount, vault, user: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      }).signers([authority]).rpc();
    } catch (e) {}

    // Create a capability targeted at the treasury for the assert → execute → record flow.
    const agent = await program.account.agent.fetch(agentPda);
    const epoch = agent.currentEpoch;
    [capabilityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("capability"), Buffer.from(agentId), epoch.toArrayLike(Buffer, "le", 8), treasuryPda.toBuffer()],
      program.programId
    );
    await program.methods.requestCapability({
      capabilityType: { payService: {} },
      targetProgram: treasuryPda, targetAccount: recipientTokenAccount,
      amountLimit: new BN(5_000_000), frequencyLimit: new BN(100), ttlSeconds: new BN(3600),
    }).accounts({
      agent: agentPda, policy: policyPda, capability: capabilityPda,
      authorityRoot: authority.publicKey, systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();
    const cap = await program.account.capability.fetch(capabilityPda);
    capabilityId = new Uint8Array(cap.capabilityId);
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
    const [executionPda] = deriveExecutionPda(agentId, nonce, program.programId);
    try {
      await program.methods.assertCapability({
        actionType: { payService: {} }, targetProgram: cap.targetProgram,
        targetAccount: cap.targetAccount, amount: new BN(1_000_000), actionNonce: nonce,
      }).accounts({
        agent: agentPda, capability: oldCapabilityPda, policy: policyPda,
        consumedNonce: consumedNoncePda, execution: executionPda,
        authorityRoot: authority.publicKey,
        systemProgram: SystemProgram.programId,
      }).signers([authority]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("StaleEpoch");
    }
  });
});
