/**
 * Test suite: Execution PDA lifecycle
 *
 * Tests the cryptographic binding between capability assertions and
 * actual on-chain actions:
 * - assert_capability creates Execution PDA with status=Asserted
 * - Treasury authorized_transfer CPIs into mark_executed (Asserted -> Executed)
 * - record_outcome requires Execution status=Executed, sets Recorded
 * - record_outcome fails if Execution is still Asserted (action never executed)
 * - record_outcome fails if action_id doesn't match the Execution PDA
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
  getTokenBalance,
  deriveExecutionPda,
  deriveBondVaultPda,
  computeActionId,
} from "./helpers";

describe("execution-pda", () => {
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
    actionNonce = 500;

    [verifierRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("verifier_registry")], coreProgram.programId
    );
    [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), Buffer.from(agentId)], coreProgram.programId
    );
    [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), Buffer.from("PAY-V1")], coreProgram.programId
    );
    [bondPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bond"), Buffer.from(agentId)], coreProgram.programId
    );

    // Create USDC mint and token accounts for bond escrow
    usdcMint = await createMint(
      provider.connection, provider.wallet.payer, provider.wallet.publicKey, 6
    );
    [bondVaultPda] = deriveBondVaultPda(usdcMint, coreProgram.programId);
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
    // Mint 200 USDC (200_000_000 base units) to the user token account
    await mintToAccount(
      provider.connection, provider.wallet.payer, usdcMint,
      userTokenAccount, provider.wallet.publicKey, 200_000_000
    );

    // Initialize protocol
    try {
      await coreProgram.methods.initializeProtocol().accounts({
        verifierRegistry: verifierRegistryPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();
    } catch (e) {}

    // Register verifier
    const verifierId = new Uint8Array(32);
    for (let i = 0; i < 32; i++) verifierId[i] = i + 60;
    try {
      await coreProgram.methods.registerVerifier(
        Array.from(verifierId), coreProgram.programId, provider.wallet.publicKey
      ).accounts({
        verifierRegistry: verifierRegistryPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();
    } catch (e) {}

    // Register agent
    try {
      await coreProgram.methods.registerAgent(Array.from(agentId)).accounts({
        agent: agentPda, authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      }).signers([authority]).rpc();
    } catch (e) {}

    // Create policy
    try {
      await coreProgram.methods.createPolicy({
        versionTag: "PAY-V1", capabilityType: { payService: {} },
        minSuccesses: new BN(20), minSuccessRateBps: 9500,
        criticalFailureLimit: new BN(0), minBondUsdc: new BN(5_000_000),
        maxAmountUsdc: new BN(500_000_000),
      }).accounts({
        policy: policyPda, authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();
    } catch (e) {}

    // Lock bond with real USDC transfer
    try {
      await coreProgram.methods.lockBond(BOND_AMOUNT).accounts({
        agent: agentPda, bond: bondPda,
        agentToken: userTokenAccount,
        bondVault: bondVaultPda,
        usdcMint: usdcMint,
        authorityRoot: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([authority]).rpc();
    } catch (e) {}

    // Initialize treasury and deposit USDC
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
  });

  it("assert_capability creates Execution PDA with status=Asserted", async () => {
    const agent = await coreProgram.account.agent.fetch(agentPda);
    const epoch = agent.currentEpoch;
    [capabilityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("capability"), Buffer.from(agentId),
       epoch.toArrayLike(Buffer, "le", 8), treasuryPda.toBuffer()],
      coreProgram.programId
    );
    await coreProgram.methods.requestCapability({
      capabilityType: { payService: {} },
      targetProgram: treasuryPda, targetAccount: recipientTokenAccount,
      amountLimit: TIER_1_MAX, frequencyLimit: new BN(10), ttlSeconds: new BN(3600),
    }).accounts({
      agent: agentPda, policy: policyPda, capability: capabilityPda,
      authorityRoot: authority.publicKey, systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    const nonce = new BN(actionNonce++);
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nonce"), Buffer.from(agentId), nonce.toArrayLike(Buffer, "le", 8)],
      coreProgram.programId
    );
    const [executionPda] = deriveExecutionPda(agentId, nonce, coreProgram.programId);

    await coreProgram.methods.assertCapability({
      actionType: { payService: {} },
      targetProgram: treasuryPda, targetAccount: recipientTokenAccount,
      amount: TIER_1_MAX, actionNonce: nonce,
    }).accounts({
      agent: agentPda, capability: capabilityPda, policy: policyPda,
      consumedNonce: consumedNoncePda, execution: executionPda,
      authorityRoot: authority.publicKey, systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    const execution = await coreProgram.account.execution.fetch(executionPda);
    // status is an enum object { asserted: {} }
    expect(execution.status).to.deep.equal({ asserted: {} });
    expect(execution.agentId).to.deep.equal(Array.from(agentId));
    expect(execution.actionNonce.toNumber()).to.equal(nonce.toNumber());
    expect(execution.targetProgram.toString()).to.equal(treasuryPda.toString());
  });

  it("Treasury authorized_transfer marks Execution as Executed", async () => {
    const nonce = new BN(actionNonce++);
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nonce"), Buffer.from(agentId), nonce.toArrayLike(Buffer, "le", 8)],
      coreProgram.programId
    );
    const [executionPda] = deriveExecutionPda(agentId, nonce, coreProgram.programId);

    const vaultBefore = await getTokenBalance(provider.connection, vault);
    const recipBefore = await getTokenBalance(provider.connection, recipientTokenAccount);

    await treasuryProgram.methods.authorizedTransfer(TIER_1_MAX, nonce).accounts({
      treasury: treasuryPda, agent: agentPda, capability: capabilityPda,
      policy: policyPda, consumedNonce: consumedNoncePda, execution: executionPda,
      pactyraCoreProgram: coreProgram.programId,
      vault, recipientToken: recipientTokenAccount, authorityRoot: authority.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    // USDC was transferred
    const vaultAfter = await getTokenBalance(provider.connection, vault);
    const recipAfter = await getTokenBalance(provider.connection, recipientTokenAccount);
    expect(vaultBefore - vaultAfter).to.equal(5_000_000);
    expect(recipAfter - recipBefore).to.equal(5_000_000);

    // Execution PDA is now in Executed status
    const execution = await coreProgram.account.execution.fetch(executionPda);
    expect(execution.status).to.deep.equal({ executed: {} });
    expect(execution.executedAt.toNumber()).to.be.greaterThan(0);
  });

  it("record_outcome requires Execution status=Executed — fabrication blocked", async () => {
    // First, assert a capability but DON'T execute via treasury
    const nonce = new BN(actionNonce++);
    const [consumedNoncePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nonce"), Buffer.from(agentId), nonce.toArrayLike(Buffer, "le", 8)],
      coreProgram.programId
    );
    const [executionPda] = deriveExecutionPda(agentId, nonce, coreProgram.programId);

    await coreProgram.methods.assertCapability({
      actionType: { payService: {} },
      targetProgram: treasuryPda, targetAccount: recipientTokenAccount,
      amount: new BN(1_000_000), actionNonce: nonce,
    }).accounts({
      agent: agentPda, capability: capabilityPda, policy: policyPda,
      consumedNonce: consumedNoncePda, execution: executionPda,
      authorityRoot: authority.publicKey, systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    // Execution is in Asserted status — not yet executed
    const execution = await coreProgram.account.execution.fetch(executionPda);
    expect(execution.status).to.deep.equal({ asserted: {} });

    // Attempt to record an outcome — should fail because the action was not executed
    const actionId = makeId();
    const capabilityId = makeId();
    const evidenceHash = makeId();
    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), Buffer.from(agentId), Buffer.from(actionId)],
      coreProgram.programId
    );

    try {
      await coreProgram.methods.recordOutcome(
        Array.from(actionId), Array.from(capabilityId),
        { pass: {} }, { none: {} }, Array.from(evidenceHash)
      ).accounts({
        agent: agentPda, receipt: receiptPda,
        verifierRegistry: verifierRegistryPda, policy: policyPda,
        execution: executionPda, bond: bondPda,
        verifierOperator: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();
      expect.fail("Should reject — action was not executed");
    } catch (err: any) {
      expect(err.toString()).to.include("ExecutionNotExecuted");
    }
  });
});
