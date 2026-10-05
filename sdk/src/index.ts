/**
 * PACTYRA Client SDK
 *
 * Evidence-bound economic authority for autonomous agents.
 *
 * Usage:
 *   import { PactyraClient } from '@pactyra/client';
 *   const client = await PactyraClient.connect(wallet, connection);
 *   await client.registerAgent(agentId);
 *   await client.lockBond(new BN(5_000_000));
 *   await client.requestCapability(params);
 *   await client.assertCapability(action);
 */

export { PactyraClient } from "./client";
export { PACTYRA_CORE_PROGRAM_ID, PACTYRA_VERIFIER_PROGRAM_ID, REFERENCE_TREASURY_PROGRAM_ID } from "./constants";
export { Tier, AgentStatus, CapabilityStatus, CapabilityType, OutcomeResult, Severity } from "./types";
export { deriveAgentPda, deriveCapabilityPda, deriveBondPda, derivePolicyPda, deriveVerifierRegistryPda, deriveConsumedNoncePda, deriveReceiptPda } from "./pdas";
export { PactyraX402Adapter } from "./adapters/x402";
