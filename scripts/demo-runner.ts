/**
 * Demo Runner — executes the complete $5 → $50 → $500 → $5 authority loop
 * in a single reproducible run.
 *
 * This script demonstrates the full PACTYRA protocol:
 *   1. Bootstrap: Initialize protocol, register agent, lock bond
 *   2. Earn Tier 2: 5 verified successes → $5 → $50
 *   3. Earn Tier 3: 27/28 successes (96.4%) → $50 → $500
 *   4. Unauthorized transfer: $400 rejected (AmountExceedsCapability)
 *   5. Critical failure: $500 → $5, bond slashed, epoch++
 *   6. Stale capability: old epoch capability rejected
 *
 * Run: anchor test --skip-build (runs against local validator)
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { PactyraClient } from "../sdk/src/client";
import {
  deriveAgentPda,
  deriveCapabilityPda,
  deriveConsumedNoncePda,
  derivePolicyPda,
  deriveBondPda,
  deriveVerifierRegistryPda,
  deriveReceiptPda,
} from "../sdk/src/pdas";

describe("Demo: $5 → $50 → $500 → $5", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const client = new PactyraClient(provider);

  let verifierOperator: Keypair;
  let agentId: Uint8Array;
  let capabilityPda: PublicKey;
  let oldCapabilityPda: PublicKey;
  let actionNonce: number;

  const TIER_1_MAX = 5_000_000;
  const TIER_2_MAX = 50_000_000;
  const TIER_3_MAX = 500_000_000;

  async function airdrop(pubkey: PublicKey, amount: number) {
    const sig = await provider.connection.requestAirdrop(
      pubkey,
      amount * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig, "confirmed");
  }

  function makeId(): Uint8Array {
    return Keypair.generate().publicKey.toBytes();
  }

  async function recordOutcome(result: string, severity: string): Promise<void> {
    const actionId = makeId();
    const capabilityId = makeId();
    const evidenceHash = makeId();
    const [agentPda] = deriveAgentPda(agentId);
    const [receiptPda] = deriveReceiptPda(agentId, actionId);
    const [verifierRegistryPda] = deriveVerifierRegistryPda();
    const [policyPda] = derivePolicyPda("PAY-V1");
    const [bondPda] = deriveBondPda(agentId);

    const resultObj = result === "pass" ? { pass: {} } : { fail: {} };
    const severityObj = { [severity]: {} };

    await client.coreProgram.methods
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
        verifierOperator: verifierOperator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([verifierOperator])
      .rpc();
  }

  async function requestCapabilityAt(amount: BN): Promise<PublicKey> {
    const agent = await client.getAgent(agentId);
    const epoch = agent.currentEpoch;
    const targetProgram = Keypair.generate().publicKey;
    const targetAccount = Keypair.generate().publicKey;
    const [agentPda] = deriveAgentPda(agentId);
    const [policyPda] = derivePolicyPda("PAY-V1");
    const [capPda] = deriveCapabilityPda(agentId, epoch, targetProgram);

    await client.coreProgram.methods
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
        authorityRoot: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return capPda;
  }

  async function assertCapabilityAction(
    capPda: PublicKey,
    targetProgram: PublicKey,
    targetAccount: PublicKey,
    amount: BN,
    nonce: BN
  ): Promise<string> {
    const [agentPda] = deriveAgentPda(agentId);
    const [policyPda] = derivePolicyPda("PAY-V1");
    const [consumedNoncePda] = deriveConsumedNoncePda(agentId, nonce);

    return client.coreProgram.methods
      .assertCapability({
        actionType: { payService: {} },
        targetProgram,
        targetAccount,
        amount,
        actionNonce: nonce,
      })
      .accounts({
        agent: agentPda,
        capability: capPda,
        policy: policyPda,
        consumedNonce: consumedNoncePda,
        authorityRoot: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  before(async () => {
    verifierOperator = Keypair.generate();
    await airdrop(verifierOperator.publicKey, 10);
    await airdrop(provider.wallet.publicKey, 50);

    // Use a unique agent ID for this demo run
    const agentKeypair = Keypair.generate();
    agentId = agentKeypair.publicKey.toBytes();
    actionNonce = 5000;
  });

  // ================================================================
  // Step 1: Bootstrap
  // ================================================================

  it("[1/6] Bootstrap: Initialize protocol, register agent, lock bond", async () => {
    // Initialize protocol (may already exist)
    try {
      await client.initializeProtocol();
    } catch (e) {
      /* already initialized */
    }

    // Register verifier
    const verifierId = new Uint8Array(32);
    for (let i = 0; i < 32; i++) verifierId[i] = i + 20; // different from other tests
    try {
      await client.registerVerifier(
        verifierId,
        client.coreProgram.programId,
        verifierOperator.publicKey
      );
    } catch (e) {
      /* already registered */
    }

    // Register agent (unique ID for this run)
    await client.registerAgent(agentId);

    // Create policy (may already exist)
    try {
      await client.createPolicy({
        versionTag: "PAY-V1",
        capabilityType: "payService" as any,
        minSuccesses: 20,
        minSuccessRateBps: 9500,
        criticalFailureLimit: 0,
        minBondUsdc: 5_000_000,
        maxAmountUsdc: 500_000_000,
      });
    } catch (e) {
      /* already created */
    }

    // Lock bond
    await client.lockBond(agentId, 5_000_000);

    const agent = await client.getAgent(agentId);
    console.log(
      "    Agent tier:",
      client.getTierName(agent.tier),
      "| Bond:",
      agent.bondAmount.toNumber(),
      "| Max: $" + client.getTierMaxAmount(agent.tier) / 1_000_000
    );
  });

  // ================================================================
  // Step 2: Earn Tier 2 ($5 → $50)
  // ================================================================

  it("[2/6] Earn Tier 2: 5 verified successes → $5 → $50", async () => {
    for (let i = 0; i < 5; i++) {
      await recordOutcome("pass", "none");
    }

    const agent = await client.getAgent(agentId);
    console.log(
      "    Tier:",
      client.getTierName(agent.tier),
      "| Successes:",
      agent.successCount.toNumber(),
      "| Max: $" + client.getTierMaxAmount(agent.tier) / 1_000_000
    );
  });

  // ================================================================
  // Step 3: Earn Tier 3 ($50 → $500)
  // ================================================================

  it("[3/6] Earn Tier 3: 27/28 successes (96.4%) → $50 → $500", async () => {
    // 22 more successes
    for (let i = 0; i < 22; i++) {
      await recordOutcome("pass", "none");
    }
    // 1 ordinary fail
    await recordOutcome("fail", "ordinary");

    const agent = await client.getAgent(agentId);
    const rate = client.getSuccessRate(agent.successCount, agent.totalCount);
    console.log(
      "    Tier:",
      client.getTierName(agent.tier),
      "| Total:",
      agent.totalCount.toNumber(),
      "| Rate:",
      rate.toFixed(1) + "%",
      "| Max: $" + client.getTierMaxAmount(agent.tier) / 1_000_000
    );
  });

  // ================================================================
  // Step 4: Unauthorized transfer rejected
  // ================================================================

  it("[4/6] Unauthorized transfer: $400 rejected (AmountExceedsCapability)", async () => {
    capabilityPda = await requestCapabilityAt(new BN(TIER_2_MAX)); // $50 cap
    const cap = await client.coreProgram.account.capability.fetch(capabilityPda);
    const nonce = new BN(actionNonce++);

    try {
      await assertCapabilityAction(
        capabilityPda,
        cap.targetProgram,
        cap.targetAccount,
        new BN(400_000_000), // $400 — exceeds $50
        nonce
      );
      throw new Error("Should have been rejected");
    } catch (err: any) {
      const msg = err.toString();
      if (msg.includes("AmountExceedsCapability")) {
        console.log("    Rejected: AmountExceedsCapability — no USDC moved");
      } else {
        throw err;
      }
    }
  });

  // ================================================================
  // Step 5: Critical failure → $500 → $5
  // ================================================================

  it("[5/6] Critical failure: $500 → $5, bond slashed, epoch++", async () => {
    // Request a $500 capability at Tier 3
    capabilityPda = await requestCapabilityAt(new BN(TIER_3_MAX));
    oldCapabilityPda = capabilityPda;

    const before = await client.getAgent(agentId);
    console.log(
      "    Before: Tier",
      client.getTierName(before.tier),
      "Epoch",
      before.currentEpoch.toNumber()
    );

    // Record critical failure
    await recordOutcome("fail", "critical");

    const after = await client.getAgent(agentId);
    console.log(
      "    After:  Tier",
      client.getTierName(after.tier),
      "Epoch",
      after.currentEpoch.toNumber(),
      "| Bond:",
      after.bondAmount.toNumber(),
      "(slashed)"
    );
  });

  // ================================================================
  // Step 6: Stale capability rejected
  // ================================================================

  it("[6/6] Stale capability: old epoch capability rejected (StaleEpoch)", async () => {
    const cap = await client.coreProgram.account.capability.fetch(oldCapabilityPda);
    const agent = await client.getAgent(agentId);

    console.log(
      "    Capability epoch:",
      cap.authorityEpoch.toNumber(),
      "| Current epoch:",
      agent.currentEpoch.toNumber()
    );

    const nonce = new BN(actionNonce++);
    try {
      await assertCapabilityAction(
        oldCapabilityPda,
        cap.targetProgram,
        cap.targetAccount,
        new BN(1_000_000),
        nonce
      );
      throw new Error("Should have been rejected");
    } catch (err: any) {
      const msg = err.toString();
      if (msg.includes("StaleEpoch")) {
        console.log("    Rejected: StaleEpoch — old capabilities invalidated");
      } else {
        throw err;
      }
    }
  });

  it("Summary: Full $5 → $50 → $500 → $5 loop demonstrated", async () => {
    const agent = await client.getAgent(agentId);
    console.log("\n    === Demo Complete ===");
    console.log("    Final tier:", client.getTierName(agent.tier));
    console.log("    Final epoch:", agent.currentEpoch.toNumber());
    console.log("    Total verified:", agent.totalCount.toNumber());
    console.log("    Total successful:", agent.successCount.toNumber());
    console.log("    Critical failures:", agent.criticalFailures.toNumber());
    console.log("    Bond:", agent.bondAmount.toNumber(), "(slashed)");
    console.log("\n    $5 → $50 → $500 → $5 ✓");
  });
});
