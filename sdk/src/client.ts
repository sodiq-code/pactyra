import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  SendOptions,
} from "@solana/web3.js";
import {
  AnchorProvider,
  BN,
  Program,
  Idl,
  Wallet,
} from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  PACTYRA_CORE_PROGRAM_ID,
  PACTYRA_VERIFIER_PROGRAM_ID,
  REFERENCE_TREASURY_PROGRAM_ID,
  TIER_1_MAX_AMOUNT,
  TIER_2_MAX_AMOUNT,
  TIER_3_MAX_AMOUNT,
} from "./constants";
import {
  deriveAgentPda,
  deriveCapabilityPda,
  deriveBondPda,
  derivePolicyPda,
  deriveVerifierRegistryPda,
  deriveConsumedNoncePda,
  deriveReceiptPda,
} from "./pdas";
import {
  AgentData,
  PolicyData,
  CapabilityData,
  ReceiptData,
  CreatePolicyParams,
  RequestCapabilityParams,
  ActionParams,
  CapabilityType,
  OutcomeResult,
  Severity,
} from "./types";

const coreIdl = require("../idl/pactyra_core.json");
const verifierIdl = require("../idl/pactyra_verifier.json");
const treasuryIdl = require("../idl/reference_treasury.json");

export class PactyraClient {
  public readonly provider: AnchorProvider;
  public readonly coreProgram: Program;
  public readonly verifierProgram: Program;
  public readonly treasuryProgram: Program;

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.coreProgram = new Program(coreIdl as Idl, provider);
    this.verifierProgram = new Program(verifierIdl as Idl, provider);
    this.treasuryProgram = new Program(treasuryIdl as Idl, provider);
  }

  /**
   * Connect to a Solana cluster with a wallet.
   */
  static async connect(
    wallet: Wallet,
    connection: Connection
  ): Promise<PactyraClient> {
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    return new PactyraClient(provider);
  }

  // ================================================================
  // Protocol initialization
  // ================================================================

  async initializeProtocol(): Promise<string> {
    const [verifierRegistryPda] = deriveVerifierRegistryPda();
    return this.coreProgram.methods
      .initializeProtocol()
      .accounts({
        verifierRegistry: verifierRegistryPda,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async registerVerifier(
    verifierId: Uint8Array,
    verifierProgram: PublicKey,
    operatorKey: PublicKey
  ): Promise<string> {
    const [verifierRegistryPda] = deriveVerifierRegistryPda();
    return this.coreProgram.methods
      .registerVerifier(
        Array.from(verifierId),
        verifierProgram,
        operatorKey
      )
      .accounts({
        verifierRegistry: verifierRegistryPda,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // ================================================================
  // Agent management
  // ================================================================

  async registerAgent(agentId: Uint8Array): Promise<string> {
    const [agentPda] = deriveAgentPda(agentId);
    return this.coreProgram.methods
      .registerAgent(Array.from(agentId))
      .accounts({
        agent: agentPda,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async getAgent(agentId: Uint8Array): Promise<AgentData> {
    const [agentPda] = deriveAgentPda(agentId);
    return (await this.coreProgram.account.agent.fetch(agentPda)) as AgentData;
  }

  // ================================================================
  // Policy management
  // ================================================================

  async createPolicy(params: CreatePolicyParams): Promise<string> {
    const [policyPda] = derivePolicyPda(params.versionTag);
    const capabilityTypeObj = { [params.capabilityType]: {} };
    return this.coreProgram.methods
      .createPolicy({
        versionTag: params.versionTag,
        capabilityType: capabilityTypeObj,
        minSuccesses: new BN(params.minSuccesses),
        minSuccessRateBps: params.minSuccessRateBps,
        criticalFailureLimit: new BN(params.criticalFailureLimit),
        minBondUsdc: new BN(params.minBondUsdc),
        maxAmountUsdc: new BN(params.maxAmountUsdc),
      })
      .accounts({
        policy: policyPda,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async getPolicy(versionTag: string): Promise<PolicyData> {
    const [policyPda] = derivePolicyPda(versionTag);
    return (await this.coreProgram.account.policy.fetch(policyPda)) as PolicyData;
  }

  // ================================================================
  // Bond management
  // ================================================================

  async lockBond(agentId: Uint8Array, amount: number): Promise<string> {
    const [agentPda] = deriveAgentPda(agentId);
    const [bondPda] = deriveBondPda(agentId);
    return this.coreProgram.methods
      .lockBond(new BN(amount))
      .accounts({
        agent: agentPda,
        bond: bondPda,
        authorityRoot: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // ================================================================
  // Capability management
  // ================================================================

  async requestCapability(
    agentId: Uint8Array,
    params: RequestCapabilityParams
  ): Promise<{ signature: string; capabilityPda: PublicKey }> {
    const agent = await this.getAgent(agentId);
    const epoch = agent.currentEpoch;
    const [agentPda] = deriveAgentPda(agentId);
    const [policyPda] = derivePolicyPda("PAY-V1");
    const [capabilityPda] = deriveCapabilityPda(
      agentId,
      epoch,
      new PublicKey(params.targetProgram)
    );

    const capabilityTypeObj = { [params.capabilityType]: {} };
    const signature = await this.coreProgram.methods
      .requestCapability({
        capabilityType: capabilityTypeObj,
        targetProgram: new PublicKey(params.targetProgram),
        targetAccount: new PublicKey(params.targetAccount),
        amountLimit: new BN(params.amountLimit),
        frequencyLimit: new BN(params.frequencyLimit),
        ttlSeconds: new BN(params.ttlSeconds),
      })
      .accounts({
        agent: agentPda,
        policy: policyPda,
        capability: capabilityPda,
        authorityRoot: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { signature, capabilityPda };
  }

  async getCapability(
    agentId: Uint8Array,
    epoch: BN,
    targetProgram: PublicKey
  ): Promise<CapabilityData> {
    const [capabilityPda] = deriveCapabilityPda(agentId, epoch, targetProgram);
    return (await this.coreProgram.account.capability.fetch(
      capabilityPda
    )) as CapabilityData;
  }

  // ================================================================
  // Capability assertion (the hero instruction)
  // ================================================================

  async assertCapability(
    agentId: Uint8Array,
    action: ActionParams
  ): Promise<string> {
    const [agentPda] = deriveAgentPda(agentId);
    const agent = await this.getAgent(agentId);
    const [capabilityPda] = deriveCapabilityPda(
      agentId,
      agent.currentEpoch,
      new PublicKey(action.targetProgram)
    );
    const [policyPda] = derivePolicyPda("PAY-V1");
    const [consumedNoncePda] = deriveConsumedNoncePda(
      agentId,
      new BN(action.actionNonce)
    );

    const actionTypeObj = { [action.actionType]: {} };
    return this.coreProgram.methods
      .assertCapability({
        actionType: actionTypeObj,
        targetProgram: new PublicKey(action.targetProgram),
        targetAccount: new PublicKey(action.targetAccount),
        amount: new BN(action.amount),
        actionNonce: new BN(action.actionNonce),
      })
      .accounts({
        agent: agentPda,
        capability: capabilityPda,
        policy: policyPda,
        consumedNonce: consumedNoncePda,
        authorityRoot: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // ================================================================
  // Outcome recording (verifier only)
  // ================================================================

  async recordOutcome(
    agentId: Uint8Array,
    actionId: Uint8Array,
    capabilityId: Uint8Array,
    result: OutcomeResult,
    severity: Severity,
    evidenceHash: Uint8Array
  ): Promise<string> {
    const [agentPda] = deriveAgentPda(agentId);
    const [receiptPda] = deriveReceiptPda(agentId, actionId);
    const [verifierRegistryPda] = deriveVerifierRegistryPda();
    const [policyPda] = derivePolicyPda("PAY-V1");
    const [bondPda] = deriveBondPda(agentId);

    const resultObj = result === OutcomeResult.Pass ? { pass: {} } : { fail: {} };
    const severityObj = { [severity]: {} };

    return this.coreProgram.methods
      .recordOutcome(
        Array.from(actionId),
        Array.from(capabilityId),
        resultObj,
        severityObj,
        Array.from(evidenceHash)
      )
      .accounts({
        agent: agentPda,
        receipt: receiptPda,
        verifierRegistry: verifierRegistryPda,
        policy: policyPda,
        bond: bondPda,
        verifierOperator: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async getReceipt(
    agentId: Uint8Array,
    actionId: Uint8Array
  ): Promise<ReceiptData> {
    const [receiptPda] = deriveReceiptPda(agentId, actionId);
    return (await this.coreProgram.account.receipt.fetch(
      receiptPda
    )) as ReceiptData;
  }

  async revokeCapability(
    agentId: Uint8Array,
    capabilityPda: PublicKey
  ): Promise<string> {
    const [agentPda] = deriveAgentPda(agentId);
    return this.coreProgram.methods
      .revokeCapability()
      .accounts({
        agent: agentPda,
        capability: capabilityPda,
        authorityRoot: this.provider.wallet.publicKey,
      })
      .rpc();
  }

  // ================================================================
  // Treasury operations
  // ================================================================

  async initializeTreasury(
    usdcMint: PublicKey,
    feeBps: number = 0
  ): Promise<{ signature: string; treasuryPda: PublicKey; vaultPda: PublicKey }> {
    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), this.provider.wallet.publicKey.toBuffer()],
      REFERENCE_TREASURY_PROGRAM_ID
    );
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), treasuryPda.toBuffer()],
      REFERENCE_TREASURY_PROGRAM_ID
    );

    const signature = await this.treasuryProgram.methods
      .initializeTreasury(feeBps)
      .accounts({
        treasury: treasuryPda,
        vault: vaultPda,
        usdcMint: usdcMint,
        authority: this.provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { signature, treasuryPda, vaultPda };
  }

  async authorizedTransfer(
    treasuryPda: PublicKey,
    agentId: Uint8Array,
    capabilityPda: PublicKey,
    vault: PublicKey,
    recipientToken: PublicKey,
    amount: number,
    actionNonce: number
  ): Promise<string> {
    const [agentPda] = deriveAgentPda(agentId);
    const [policyPda] = derivePolicyPda("PAY-V1");
    const [consumedNoncePda] = deriveConsumedNoncePda(
      agentId,
      new BN(actionNonce)
    );

    return this.treasuryProgram.methods
      .authorizedTransfer(new BN(amount), new BN(actionNonce))
      .accounts({
        treasury: treasuryPda,
        agent: agentPda,
        capability: capabilityPda,
        policy: policyPda,
        consumedNonce: consumedNoncePda,
        pactyraCoreProgram: PACTYRA_CORE_PROGRAM_ID,
        vault: vault,
        recipientToken: recipientToken,
        authorityRoot: this.provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // ================================================================
  // Helpers
  // ================================================================

  getTierMaxAmount(tier: object): number {
    if ("probation" in tier) return TIER_1_MAX_AMOUNT;
    if ("proven" in tier) return TIER_2_MAX_AMOUNT;
    if ("trusted" in tier) return TIER_3_MAX_AMOUNT;
    return 0;
  }

  getTierName(tier: object): string {
    if ("probation" in tier) return "Probation";
    if ("proven" in tier) return "Proven";
    if ("trusted" in tier) return "Trusted";
    return "Unknown";
  }

  getSuccessRate(successCount: BN, totalCount: BN): number {
    if (totalCount.toNumber() === 0) return 0;
    return (successCount.toNumber() * 100) / totalCount.toNumber();
  }
}
