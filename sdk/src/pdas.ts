import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  PACTYRA_CORE_PROGRAM_ID,
  PACTYRA_VERIFIER_PROGRAM_ID,
  REFERENCE_TREASURY_PROGRAM_ID,
} from "./constants";

export function deriveAgentPda(agentId: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), Buffer.from(agentId)],
    PACTYRA_CORE_PROGRAM_ID
  );
}

export function deriveCapabilityPda(
  agentId: Uint8Array,
  epoch: BN,
  targetProgram: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("capability"),
      Buffer.from(agentId),
      epoch.toArrayLike(Buffer, "le", 8),
      targetProgram.toBuffer(),
    ],
    PACTYRA_CORE_PROGRAM_ID
  );
}

export function deriveBondPda(agentId: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bond"), Buffer.from(agentId)],
    PACTYRA_CORE_PROGRAM_ID
  );
}

export function derivePolicyPda(versionTag: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), Buffer.from(versionTag)],
    PACTYRA_CORE_PROGRAM_ID
  );
}

export function deriveVerifierRegistryPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("verifier_registry")],
    PACTYRA_CORE_PROGRAM_ID
  );
}

export function deriveConsumedNoncePda(
  agentId: Uint8Array,
  nonce: BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("nonce"),
      Buffer.from(agentId),
      nonce.toArrayLike(Buffer, "le", 8),
    ],
    PACTYRA_CORE_PROGRAM_ID
  );
}

/**
 * Derive the Execution PDA for a given agent and action nonce.
 * Seeds: [b"execution", agent_id, action_nonce]
 * The Execution PDA binds a capability assertion to the actual on-chain
 * action it authorized. Lifecycle: Asserted -> Executed -> Recorded.
 */
export function deriveExecutionPda(
  agentId: Uint8Array,
  actionNonce: BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("execution"),
      Buffer.from(agentId),
      actionNonce.toArrayLike(Buffer, "le", 8),
    ],
    PACTYRA_CORE_PROGRAM_ID
  );
}

export function deriveReceiptPda(
  agentId: Uint8Array,
  actionId: Uint8Array
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), Buffer.from(agentId), Buffer.from(actionId)],
    PACTYRA_CORE_PROGRAM_ID
  );
}

export function deriveTreasuryPda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), authority.toBuffer()],
    REFERENCE_TREASURY_PROGRAM_ID
  );
}

export function deriveVaultPda(treasury: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), treasury.toBuffer()],
    REFERENCE_TREASURY_PROGRAM_ID
  );
}

export function deriveFreshnessConfigPda(
  feedId: Uint8Array
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("freshness_config"), Buffer.from(feedId)],
    PACTYRA_VERIFIER_PROGRAM_ID
  );
}
