import { BN } from "@coral-xyz/anchor";

export enum Tier {
  Probation = "probation",
  Proven = "proven",
  Trusted = "trusted",
}

export enum AgentStatus {
  Active = "active",
  Frozen = "frozen",
}

export enum CapabilityStatus {
  Active = "active",
  Revoked = "revoked",
  Expired = "expired",
}

export enum CapabilityType {
  PayService = "payService",
  Trade = "trade",
  TreasuryWithdraw = "treasuryWithdraw",
  Delegate = "delegate",
}

export enum OutcomeResult {
  Pass = "pass",
  Fail = "fail",
}

export enum Severity {
  None = "none",
  Ordinary = "ordinary",
  Critical = "critical",
}

export interface AgentData {
  agentId: Uint8Array;
  authorityRoot: string;
  delegateAuthority: string | null;
  currentEpoch: BN;
  policyRoot: Uint8Array;
  successCount: BN;
  totalCount: BN;
  criticalFailures: BN;
  bondAmount: BN;
  tier: { probation?: {} } | { proven?: {} } | { trusted?: {} };
  status: { active?: {} } | { frozen?: {} };
}

export interface PolicyData {
  policyId: Uint8Array;
  authority: string;
  versionTag: string;
  capabilityType: object;
  minSuccesses: BN;
  minSuccessRateBps: number;
  criticalFailureLimit: BN;
  minBondUsdc: BN;
  maxAmountUsdc: BN;
  status: { active?: {} } | { superseded?: {} };
  createdSlot: BN;
}

export interface CapabilityData {
  capabilityId: Uint8Array;
  agentId: Uint8Array;
  capabilityType: object;
  targetProgram: string;
  targetAccount: string;
  amountLimit: BN;
  frequencyLimit: BN;
  expiry: BN;
  policyKey: string;
  authorityEpoch: BN;
  nonce: BN;
  status: { active?: {} } | { revoked?: {} } | { expired?: {} };
}

export interface ReceiptData {
  receiptId: Uint8Array;
  agentId: Uint8Array;
  actionId: Uint8Array;
  capabilityId: Uint8Array;
  policyKey: string;
  verifier: string;
  result: { pass?: {} } | { fail?: {} };
  severity: { none?: {} } | { ordinary?: {} } | { critical?: {} };
  evidenceHash: Uint8Array;
  timestamp: BN;
  authorityEpoch: BN;
}

export interface CreatePolicyParams {
  versionTag: string;
  capabilityType: CapabilityType;
  minSuccesses: number;
  minSuccessRateBps: number;
  criticalFailureLimit: number;
  minBondUsdc: number;
  maxAmountUsdc: number;
}

export interface RequestCapabilityParams {
  capabilityType: CapabilityType;
  targetProgram: string;
  targetAccount: string;
  amountLimit: number;
  frequencyLimit: number;
  ttlSeconds: number;
}

export interface ActionParams {
  actionType: CapabilityType;
  targetProgram: string;
  targetAccount: string;
  amount: number;
  actionNonce: number;
}
