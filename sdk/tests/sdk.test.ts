import { BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import { PactyraClient } from "../src/client";
import {
  PACTYRA_CORE_PROGRAM_ID,
  PACTYRA_VERIFIER_PROGRAM_ID,
  REFERENCE_TREASURY_PROGRAM_ID,
  TIER_1_MAX_AMOUNT,
  TIER_2_MAX_AMOUNT,
  TIER_3_MAX_AMOUNT,
  DEVNET_USDC_MINT,
  T1_TO_T2_THRESHOLD,
} from "../src/constants";
import {
  deriveAgentPda,
  deriveBondPda,
  derivePolicyPda,
  deriveVerifierRegistryPda,
  deriveConsumedNoncePda,
  deriveCapabilityPda,
  deriveExecutionPda,
  deriveReceiptPda,
  deriveTreasuryPda,
  deriveVaultPda,
  deriveFreshnessConfigPda,
} from "../src/pdas";
import {
  Tier,
  AgentStatus,
  CapabilityStatus,
  CapabilityType,
  OutcomeResult,
  Severity,
} from "../src/types";

describe("@pactyra/client SDK", () => {
  let client: PactyraClient;
  let agentId: Uint8Array;

  before(async () => {
    const connection = new Connection("http://localhost:8899", "confirmed");
    const mockWallet = {
      publicKey: Keypair.generate().publicKey,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };
    client = await PactyraClient.connect(mockWallet as any, connection);

    const agentKeypair = Keypair.generate();
    agentId = agentKeypair.publicKey.toBytes();
  });

  it("Connects to a cluster", async () => {
    expect(client).to.be.an.instanceof(PactyraClient);
  });

  it("Exposes all three programs", async () => {
    expect(client.coreProgram.programId.toString()).to.equal(
      PACTYRA_CORE_PROGRAM_ID.toString()
    );
    expect(client.verifierProgram.programId.toString()).to.equal(
      PACTYRA_VERIFIER_PROGRAM_ID.toString()
    );
    expect(client.treasuryProgram.programId.toString()).to.equal(
      REFERENCE_TREASURY_PROGRAM_ID.toString()
    );
  });

  it("Exports correct program IDs", async () => {
    expect(PACTYRA_CORE_PROGRAM_ID.toString()).to.equal(
      "EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC"
    );
    expect(PACTYRA_VERIFIER_PROGRAM_ID.toString()).to.equal(
      "5dK7xXDUSHDcP8qFxrLLFo4Nm2Xzn7rSKgDMmrFFLZsN"
    );
    expect(REFERENCE_TREASURY_PROGRAM_ID.toString()).to.equal(
      "6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9"
    );
  });

  it("Exports devnet USDC mint", async () => {
    expect(DEVNET_USDC_MINT.toString()).to.equal(
      "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
    );
  });

  it("Exports tier amount constants", async () => {
    expect(TIER_1_MAX_AMOUNT).to.equal(5_000_000);
    expect(TIER_2_MAX_AMOUNT).to.equal(50_000_000);
    expect(TIER_3_MAX_AMOUNT).to.equal(500_000_000);
    expect(T1_TO_T2_THRESHOLD).to.equal(5);
  });

  it("Derives agent PDA correctly", async () => {
    const [agentPda, bump] = deriveAgentPda(agentId);
    expect(agentPda).to.be.an.instanceof(PublicKey);
    expect(bump).to.be.a("number");
    expect(agentPda.toBytes()).to.have.length(32);
  });

  it("Derives bond PDA correctly", async () => {
    const [bondPda, bump] = deriveBondPda(agentId);
    expect(bondPda).to.be.an.instanceof(PublicKey);
    expect(bump).to.be.a("number");
  });

  it("Derives policy PDA correctly", async () => {
    const [policyPda, bump] = derivePolicyPda("PAY-V1");
    expect(policyPda).to.be.an.instanceof(PublicKey);
    expect(bump).to.be.a("number");
  });

  it("Derives verifier registry PDA correctly", async () => {
    const [registryPda, bump] = deriveVerifierRegistryPda();
    expect(registryPda).to.be.an.instanceof(PublicKey);
    expect(bump).to.be.a("number");
  });

  it("Derives consumed nonce PDA correctly", async () => {
    const nonce = new BN(42);
    const [noncePda, bump] = deriveConsumedNoncePda(agentId, nonce);
    expect(noncePda).to.be.an.instanceof(PublicKey);
    expect(bump).to.be.a("number");
  });

  it("Derives capability PDA with target_program seed", async () => {
    const epoch = new BN(1);
    const targetProgram = Keypair.generate().publicKey;
    const [capPda, bump] = deriveCapabilityPda(agentId, epoch, targetProgram);
    expect(capPda).to.be.an.instanceof(PublicKey);
    expect(bump).to.be.a("number");
  });

  it("Derives receipt PDA correctly", async () => {
    const actionId = new Uint8Array(32);
    for (let i = 0; i < 32; i++) actionId[i] = i;
    const [receiptPda, bump] = deriveReceiptPda(agentId, actionId);
    expect(receiptPda).to.be.an.instanceof(PublicKey);
    expect(bump).to.be.a("number");
  });

  it("Derives execution PDA correctly", async () => {
    const actionNonce = new BN(99);
    const [executionPda, bump] = deriveExecutionPda(agentId, actionNonce);
    expect(executionPda).to.be.an.instanceof(PublicKey);
    expect(bump).to.be.a("number");
    expect(executionPda.toBytes()).to.have.length(32);
    // Execution PDA must differ from other PDAs derived from the same agent_id
    const [agentPda] = deriveAgentPda(agentId);
    expect(executionPda.equals(agentPda)).to.be.false;
  });

  it("Computes deterministic action_id", async () => {
    const capabilityId = new Uint8Array(32);
    for (let i = 0; i < 32; i++) capabilityId[i] = i + 1;
    const targetProgram = Keypair.generate().publicKey;
    const targetAccount = Keypair.generate().publicKey;

    const actionId1 = PactyraClient.computeActionId(
      agentId,
      capabilityId,
      "payService",
      targetProgram,
      targetAccount,
      5_000_000,
      42
    );
    const actionId2 = PactyraClient.computeActionId(
      agentId,
      capabilityId,
      "payService",
      targetProgram,
      targetAccount,
      5_000_000,
      42
    );

    // Determinism: same inputs -> same output
    expect(Buffer.from(actionId1).equals(Buffer.from(actionId2))).to.be.true;
    expect(actionId1).to.have.length(32);

    // Different nonce -> different action_id
    const actionId3 = PactyraClient.computeActionId(
      agentId,
      capabilityId,
      "payService",
      targetProgram,
      targetAccount,
      5_000_000,
      43
    );
    expect(Buffer.from(actionId1).equals(Buffer.from(actionId3))).to.be.false;
  });

  it("Derives treasury PDA correctly", async () => {
    const authority = Keypair.generate().publicKey;
    const [treasuryPda, bump] = deriveTreasuryPda(authority);
    expect(treasuryPda).to.be.an.instanceof(PublicKey);
    expect(bump).to.be.a("number");
  });

  it("Derives vault PDA correctly", async () => {
    const treasury = Keypair.generate().publicKey;
    const [vaultPda, bump] = deriveVaultPda(treasury);
    expect(vaultPda).to.be.an.instanceof(PublicKey);
    expect(bump).to.be.a("number");
  });

  it("Derives freshness config PDA correctly", async () => {
    const feedId = new Uint8Array(32);
    for (let i = 0; i < 32; i++) feedId[i] = i + 1;
    const [configPda, bump] = deriveFreshnessConfigPda(feedId);
    expect(configPda).to.be.an.instanceof(PublicKey);
    expect(bump).to.be.a("number");
  });

  it("Returns tier name from tier object", async () => {
    expect(client.getTierName({ probation: {} })).to.equal("Probation");
    expect(client.getTierName({ proven: {} })).to.equal("Proven");
    expect(client.getTierName({ trusted: {} })).to.equal("Trusted");
  });

  it("Returns tier max from tier object", async () => {
    expect(client.getTierMaxAmount({ probation: {} })).to.equal(
      TIER_1_MAX_AMOUNT
    );
    expect(client.getTierMaxAmount({ proven: {} })).to.equal(
      TIER_2_MAX_AMOUNT
    );
    expect(client.getTierMaxAmount({ trusted: {} })).to.equal(
      TIER_3_MAX_AMOUNT
    );
  });

  it("Computes success rate correctly", async () => {
    expect(client.getSuccessRate(new BN(27), new BN(28))).to.be.closeTo(
      96.43,
      0.1
    );
    expect(client.getSuccessRate(new BN(5), new BN(5))).to.equal(100);
    expect(client.getSuccessRate(new BN(0), new BN(0))).to.equal(0);
  });

  it("Exports all enums", async () => {
    expect(Tier.Probation).to.equal("probation");
    expect(Tier.Proven).to.equal("proven");
    expect(Tier.Trusted).to.equal("trusted");
    expect(AgentStatus.Active).to.equal("active");
    expect(AgentStatus.Frozen).to.equal("frozen");
    expect(CapabilityStatus.Active).to.equal("active");
    expect(CapabilityStatus.Revoked).to.equal("revoked");
    expect(CapabilityType.PayService).to.equal("payService");
    expect(CapabilityType.Trade).to.equal("trade");
    expect(OutcomeResult.Pass).to.equal("pass");
    expect(OutcomeResult.Fail).to.equal("fail");
    expect(Severity.None).to.equal("none");
    expect(Severity.Critical).to.equal("critical");
  });
});
