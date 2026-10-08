/**
 * Test suite: Bond lifecycle
 *
 * Tests:
 * - Bond lock with real USDC escrow
 * - Insufficient bond rejects capability request
 *
 * Note: Bond slashing on critical failure is exercised in execution.ts via
 * the full assert -> execute -> record_outcome flow, which requires the
 * Execution PDA to be in Executed status. This suite focuses on the
 * lock_bond instruction itself.
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import {
  airdrop,
  BOND_AMOUNT,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createTokenAccount,
  mintToAccount,
  deriveBondVaultPda,
} from "./helpers";

describe("bond", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.PactyraCore as any;

  let authority: Keypair;
  let verifierOperator: Keypair;
  let agentId: Uint8Array;
  let agentPda: PublicKey;
  let bondPda: PublicKey;
  let bondVaultPda: PublicKey;
  let policyPda: PublicKey;
  let verifierRegistryPda: PublicKey;
  let usdcMint: PublicKey;
  let userTokenAccount: PublicKey;

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

    try { await program.methods.initializeProtocol().accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    const verifierId = new Uint8Array(32);
    for (let i = 0; i < 32; i++) verifierId[i] = i + 80;
    try { await program.methods.registerVerifier(Array.from(verifierId), program.programId, verifierOperator.publicKey).accounts({ verifierRegistry: verifierRegistryPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
    try { await program.methods.registerAgent(Array.from(agentId)).accounts({ agent: agentPda, authority: authority.publicKey, systemProgram: SystemProgram.programId }).signers([authority]).rpc(); } catch (e) {}
    try { await program.methods.createPolicy({ versionTag: "PAY-V1", capabilityType: { payService: {} }, minSuccesses: new BN(20), minSuccessRateBps: 9500, criticalFailureLimit: new BN(0), minBondUsdc: new BN(5_000_000), maxAmountUsdc: new BN(500_000_000) }).accounts({ policy: policyPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId }).rpc(); } catch (e) {}
  });

  it("Bond lock works — USDC transferred to bond vault", async () => {
    const vaultBefore = await provider.connection.getTokenAccountBalance(bondVaultPda).catch(() => ({ value: { amount: "0" } }));
    await program.methods.lockBond(BOND_AMOUNT).accounts({
      agent: agentPda, bond: bondPda,
      agentToken: userTokenAccount, bondVault: bondVaultPda, usdcMint: usdcMint,
      authorityRoot: authority.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).signers([authority]).rpc();

    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.bondAmount.toNumber()).to.equal(5_000_000);
    const bond = await program.account.bond.fetch(bondPda);
    expect(bond.amount.toNumber()).to.equal(5_000_000);
    expect(bond.slashed).to.equal(false);

    // Bond vault now holds the escrowed USDC
    const vaultAfter = await provider.connection.getTokenAccountBalance(bondVaultPda);
    expect(parseInt(vaultAfter.value.amount)).to.equal(
      parseInt(vaultBefore.value.amount) + 5_000_000
    );
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
