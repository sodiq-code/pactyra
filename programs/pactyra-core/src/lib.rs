#![allow(deprecated)]
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("FoZa1E3b6LUeGJSAPLS57h7EQktvg3f46DWynDJxowTf");

// ============================================================
// Enums
// ============================================================

/// Authority tiers for agent economic access.
#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace, Default,
)]
pub enum AuthorityTier {
    #[default]
    Probation,
    Proven,
    Trusted,
}

/// Agent status.
#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace, Default,
)]
pub enum AgentStatus {
    #[default]
    Active,
    Frozen,
}

/// Capability lifecycle status.
#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace, Default,
)]
pub enum CapabilityStatus {
    #[default]
    Active,
    Revoked,
    Expired,
}

/// Capability action classes.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum CapabilityType {
    PayService,
    Trade,
    TreasuryWithdraw,
    Delegate,
}

/// Receipt outcome severity.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Severity {
    None,
    Ordinary,
    Critical,
}

/// Receipt outcome result.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum OutcomeResult {
    Pass,
    Fail,
}

/// Policy lifecycle status.
#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace, Default,
)]
pub enum PolicyStatus {
    #[default]
    Active,
    Superseded,
}

// ============================================================
// Account Types
// ============================================================

/// An autonomous agent with earned economic authority.
#[account]
#[derive(InitSpace)]
pub struct Agent {
    pub agent_id: [u8; 32],
    pub authority_root: Pubkey,
    pub delegate_authority: Option<Pubkey>,
    pub current_epoch: u64,
    pub policy_root: [u8; 32],
    pub success_count: u64,
    pub total_count: u64,
    pub critical_failures: u64,
    pub bond_amount: u64,
    pub tier: AuthorityTier,
    pub status: AgentStatus,
    pub bump: u8,
}

/// A fixed policy that defines authority requirements.
#[account]
#[derive(InitSpace)]
pub struct Policy {
    pub policy_id: [u8; 32],
    pub authority: Pubkey,
    #[max_len(64)]
    pub version_tag: String,
    pub capability_type: CapabilityType,
    pub min_successes: u64,
    pub min_success_rate_bps: u16,
    pub critical_failure_limit: u64,
    pub min_bond_usdc: u64,
    pub max_amount_usdc: u64,
    pub status: PolicyStatus,
    pub created_slot: u64,
    pub superseded_by: Option<[u8; 32]>,
    pub bump: u8,
}

/// An evidence-bound capability granted to an agent.
#[account]
#[derive(InitSpace)]
pub struct Capability {
    pub capability_id: [u8; 32],
    pub agent_id: [u8; 32],
    pub capability_type: CapabilityType,
    pub target_program: Pubkey,
    pub target_account: Pubkey,
    pub amount_limit: u64,
    pub frequency_limit: u64,
    pub use_count: u64,
    pub expiry: i64,
    pub policy_key: Pubkey,
    pub authority_epoch: u64,
    pub nonce: u64,
    pub status: CapabilityStatus,
    pub bump: u8,
}

/// A locked bond backing an agent's authority.
#[account]
#[derive(InitSpace)]
pub struct Bond {
    pub agent_id: [u8; 32],
    pub amount: u64,
    pub locked_at: i64,
    pub slashed: bool,
    pub bump: u8,
}

/// A performance receipt recording a verified outcome.
#[account]
#[derive(InitSpace)]
pub struct Receipt {
    pub receipt_id: [u8; 32],
    pub agent_id: [u8; 32],
    pub action_id: [u8; 32],
    pub capability_id: [u8; 32],
    pub policy_key: Pubkey,
    pub verifier: Pubkey,
    pub result: OutcomeResult,
    pub severity: Severity,
    pub evidence_hash: [u8; 32],
    pub timestamp: i64,
    pub authority_epoch: u64,
    pub bump: u8,
}

/// Registry of authorized verifiers.
#[account]
#[derive(InitSpace)]
pub struct VerifierRegistry {
    pub authority: Pubkey,
    #[max_len(8)]
    pub verifiers: Vec<VerifierEntry>,
    pub bump: u8,
}

/// A single verifier entry in the registry.
#[account]
#[derive(InitSpace)]
pub struct VerifierEntry {
    pub verifier_id: [u8; 32],
    pub verifier_program: Pubkey,
    pub operator_key: Pubkey,
    pub active: bool,
    pub registered_slot: u64,
}

/// Tracks consumed action nonces for replay protection.
#[account]
#[derive(InitSpace)]
pub struct ConsumedNonce {
    pub agent_id: [u8; 32],
    pub nonce: u64,
    pub consumed_at: i64,
    pub bump: u8,
}

/// Delegate scope for session keys — bounds what a delegate can do.
#[account]
#[derive(InitSpace)]
pub struct DelegateScope {
    pub agent_id: [u8; 32],
    pub delegate: Pubkey,
    pub max_amount_per_action: u64,
    pub expires_at: i64,
    pub bump: u8,
}

/// A timelocked trust-root operation awaiting execution.
#[account]
#[derive(InitSpace)]
pub struct TimelockedOperation {
    pub operation_type: u8,
    pub proposer: Pubkey,
    pub proposed_at: i64,
    pub execute_after: i64,
    pub executed: bool,
    pub cancelled: bool,
    pub bump: u8,
}

/// Lifecycle status of an Execution PDA.
/// An Execution PDA binds an asserted capability to the actual on-chain
/// effects it authorized, so that record_outcome cannot be fabricated for
/// actions that never happened.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum ExecutionStatus {
    /// Capability was asserted via assert_capability. Action is authorized
    /// but its on-chain effects have not yet been applied.
    Asserted,
    /// The target program marked the execution as performed via mark_executed.
    /// The action's on-chain effects have been applied.
    Executed,
    /// record_outcome has consumed this execution. No further updates allowed.
    Recorded,
}

/// An Execution PDA — binds a capability assertion to the actual on-chain
/// action it authorized. Created in assert_capability, advanced to Executed
/// by the target program via mark_executed, and finalized to Recorded in
/// record_outcome.
#[account]
#[derive(InitSpace)]
pub struct Execution {
    /// Deterministic hash of (agent_id, capability_id, action_type, target_program,
    /// target_account, amount, action_nonce). Computed identically in
    /// assert_capability and record_outcome so the receipt is bound to the
    /// exact action that was asserted and executed.
    pub action_id: [u8; 32],
    pub agent_id: [u8; 32],
    pub capability_id: [u8; 32],
    pub action_type: CapabilityType,
    pub target_program: Pubkey,
    pub target_account: Pubkey,
    pub amount: u64,
    pub action_nonce: u64,
    pub authority_epoch: u64,
    pub asserted_at: i64,
    pub executed_at: i64,
    pub status: ExecutionStatus,
    pub bump: u8,
}

// ============================================================
// Tier Amount Limits (USDC base units, 6 decimals)
// ============================================================

const TIER_1_MAX_AMOUNT: u64 = 5_000_000;
const TIER_2_MAX_AMOUNT: u64 = 50_000_000;
const TIER_3_MAX_AMOUNT: u64 = 500_000_000;

/// Number of verified successes required for T1 → T2 upgrade.
const T1_TO_T2_THRESHOLD: u64 = 5;

/// Timelock delay in seconds for trust-root operations (24 hours).
const TIMELOCK_DELAY_SECONDS: i64 = 86400;

/// Operation type constants for timelocked operations.
#[allow(dead_code)]
const OP_REGISTER_VERIFIER: u8 = 1;
#[allow(dead_code)]
const OP_DEPRECATE_VERIFIER: u8 = 2;
#[allow(dead_code)]
const OP_REPLACE_AUTHORITY: u8 = 3;

// ============================================================
// Error Codes
// ============================================================

#[error_code]
pub enum PactyraError {
    #[msg("The agent is not active")]
    AgentNotActive,
    #[msg("The capability is not active")]
    CapabilityNotActive,
    #[msg("The authority epoch is stale")]
    StaleEpoch,
    #[msg("The policy does not match")]
    PolicyMismatch,
    #[msg("The capability has expired")]
    CapabilityExpired,
    #[msg("The nonce has already been consumed")]
    NonceAlreadyConsumed,
    #[msg("The target is not in the permitted scope")]
    TargetNotInScope,
    #[msg("The action type is not permitted")]
    ActionTypeNotPermitted,
    #[msg("The amount exceeds the capability limit")]
    AmountExceedsCapability,
    #[msg("The required bond is not satisfied")]
    BondNotSatisfied,
    #[msg("The signer is not the agent authority root")]
    WrongAgent,
    #[msg("The delegate scope was exceeded")]
    DelegateScopeExceeded,
    #[msg("The verifier is not authorized")]
    UnauthorizedVerifier,
    #[msg("The action was not executed")]
    ActionNotExecuted,
    #[msg("The agent authority root does not match")]
    AuthorityRootMismatch,
    #[msg("The policy is superseded")]
    PolicySuperseded,
    #[msg("The bond has already been slashed")]
    BondAlreadySlashed,
    #[msg("Insufficient bond amount")]
    InsufficientBond,
    #[msg("The capability was revoked")]
    CapabilityRevoked,
    #[msg("The capability does not belong to this agent")]
    CapabilityAgentMismatch,
    #[msg("The target program does not match")]
    TargetProgramMismatch,
    #[msg("The amount exceeds the tier limit for this agent")]
    AmountExceedsTier,
    #[msg("The operation is not yet executable — timelock not expired")]
    TimelockNotExpired,
    #[msg("The operation has already been executed")]
    OperationAlreadyExecuted,
    #[msg("The operation has been cancelled")]
    OperationCancelled,
    #[msg("The delegate scope has expired")]
    DelegateScopeExpired,
    #[msg("The delegate amount exceeds the scope limit")]
    DelegateAmountExceedsScope,
    #[msg("The agent is frozen")]
    AgentFrozen,
    #[msg("The verifier is not active")]
    VerifierNotActive,
    #[msg("The policy is already superseded")]
    PolicyAlreadySuperseded,
    #[msg("Unauthorized — only the proposer can cancel")]
    UnauthorizedCancellation,
    #[msg("The evidence hash is invalid (all zeros)")]
    InvalidEvidence,
    #[msg("Cannot close a receipt from the current authority epoch")]
    ReceiptFromCurrentEpoch,
    #[msg("The execution PDA was not found for this action")]
    ExecutionNotFound,
    #[msg("The execution PDA action_id does not match the recorded action")]
    ExecutionActionMismatch,
    #[msg("The execution PDA is still asserted — the action has not been marked executed")]
    ExecutionNotExecuted,
    #[msg("The execution PDA has already been recorded — cannot record twice")]
    ExecutionAlreadyRecorded,
    #[msg("Only the target program can mark an execution as executed")]
    UnauthorizedExecutionMarker,
    #[msg("The capability frequency limit has been exceeded")]
    FrequencyLimitExceeded,
}

// ============================================================
// Instruction Arguments
// ============================================================

/// Parameters for creating a policy.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CreatePolicyParams {
    pub version_tag: String,
    pub capability_type: CapabilityType,
    pub min_successes: u64,
    pub min_success_rate_bps: u16,
    pub critical_failure_limit: u64,
    pub min_bond_usdc: u64,
    pub max_amount_usdc: u64,
}

/// Parameters for requesting a capability.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct RequestCapabilityParams {
    pub capability_type: CapabilityType,
    pub target_program: Pubkey,
    pub target_account: Pubkey,
    pub amount_limit: u64,
    pub frequency_limit: u64,
    pub ttl_seconds: i64,
}

/// Parameters for asserting a capability.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ActionParams {
    pub action_type: CapabilityType,
    pub target_program: Pubkey,
    pub target_account: Pubkey,
    pub amount: u64,
    pub action_nonce: u64,
}

// ============================================================
// Program Instructions
// ============================================================

#[program]
pub mod pactyra_core {
    use super::*;

    /// Initialize the protocol with a verifier registry.
    pub fn initialize_protocol(ctx: Context<InitializeProtocol>) -> Result<()> {
        let registry = &mut ctx.accounts.verifier_registry;
        registry.authority = ctx.accounts.authority.key();
        registry.verifiers = Vec::new();
        registry.bump = ctx.bumps.verifier_registry;
        emit!(ProtocolInitialized {
            authority: ctx.accounts.authority.key(),
            slot: Clock::get()?.slot,
        });
        Ok(())
    }

    /// Register a new agent. The signer becomes the authority root.
    pub fn register_agent(ctx: Context<RegisterAgent>, agent_id: [u8; 32]) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        let clock = Clock::get()?;
        agent.agent_id = agent_id;
        agent.authority_root = ctx.accounts.authority.key();
        agent.delegate_authority = None;
        agent.current_epoch = 1;
        agent.policy_root = [0u8; 32];
        agent.success_count = 0;
        agent.total_count = 0;
        agent.critical_failures = 0;
        agent.bond_amount = 0;
        agent.tier = AuthorityTier::Probation;
        agent.status = AgentStatus::Active;
        agent.bump = ctx.bumps.agent;
        emit!(AgentRegistered {
            agent_id,
            authority_root: ctx.accounts.authority.key(),
            slot: clock.slot,
        });
        Ok(())
    }

    /// Create a new policy. Policies are immutable once created.
    pub fn create_policy(ctx: Context<CreatePolicy>, params: CreatePolicyParams) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        let clock = Clock::get()?;

        let policy_id = {
            let mut hash_data = Vec::new();
            hash_data.extend_from_slice(params.version_tag.as_bytes());
            hash_data.extend_from_slice(&[params.capability_type as u8]);
            hash_data.extend_from_slice(&params.min_successes.to_le_bytes());
            hash_data.extend_from_slice(&params.min_success_rate_bps.to_le_bytes());
            hash_data.extend_from_slice(&params.critical_failure_limit.to_le_bytes());
            hash_data.extend_from_slice(&params.min_bond_usdc.to_le_bytes());
            hash_data.extend_from_slice(&params.max_amount_usdc.to_le_bytes());
            hash_data.extend_from_slice(&clock.slot.to_le_bytes());
            let hash = anchor_lang::solana_program::keccak::hash(&hash_data);
            hash.to_bytes()
        };

        policy.policy_id = policy_id;
        policy.authority = ctx.accounts.authority.key();
        policy.version_tag = params.version_tag;
        policy.capability_type = params.capability_type;
        policy.min_successes = params.min_successes;
        policy.min_success_rate_bps = params.min_success_rate_bps;
        policy.critical_failure_limit = params.critical_failure_limit;
        policy.min_bond_usdc = params.min_bond_usdc;
        policy.max_amount_usdc = params.max_amount_usdc;
        policy.status = PolicyStatus::Active;
        policy.created_slot = clock.slot;
        policy.superseded_by = None;
        policy.bump = ctx.bumps.policy;

        emit!(PolicyCreated {
            policy_id,
            version_tag: policy.version_tag.clone(),
            authority: ctx.accounts.authority.key(),
            slot: clock.slot,
        });
        Ok(())
    }

    /// Lock a bond by transferring real USDC to the protocol vault.
    /// The bond is escrowed in a PDA-owned token account.
    /// Can be called again to re-lock after a slash.
    pub fn lock_bond(ctx: Context<LockBond>, amount: u64) -> Result<()> {
        require!(amount > 0, PactyraError::InsufficientBond);

        let agent = &mut ctx.accounts.agent;
        let clock = Clock::get()?;

        // Transfer real USDC from agent's token account to the bond vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.agent_token.to_account_info(),
            to: ctx.accounts.bond_vault.to_account_info(),
            authority: ctx.accounts.authority_root.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

        // Update agent bond amount
        agent.bond_amount += amount;

        // Create or update bond record
        let bond = &mut ctx.accounts.bond;
        bond.agent_id = agent.agent_id;
        bond.locked_at = clock.unix_timestamp;
        bond.slashed = false;
        bond.amount = amount;
        bond.bump = ctx.bumps.bond;

        emit!(BondLocked {
            agent_id: agent.agent_id,
            amount,
            slot: clock.slot,
        });
        Ok(())
    }

    /// Request a capability for an agent.
    pub fn request_capability(
        ctx: Context<RequestCapability>,
        params: RequestCapabilityParams,
    ) -> Result<()> {
        let agent = &ctx.accounts.agent;
        let policy = &ctx.accounts.policy;
        let clock = Clock::get()?;

        // Verify policy is active
        require!(
            policy.status == PolicyStatus::Active,
            PactyraError::PolicySuperseded
        );

        // Verify capability type matches policy
        require!(
            policy.capability_type == params.capability_type,
            PactyraError::ActionTypeNotPermitted
        );

        // Verify amount limit does not exceed policy max
        require!(
            params.amount_limit <= policy.max_amount_usdc,
            PactyraError::AmountExceedsCapability
        );

        // Verify amount limit does not exceed the agent's tier limit
        let tier_max = match agent.tier {
            AuthorityTier::Probation => TIER_1_MAX_AMOUNT,
            AuthorityTier::Proven => TIER_2_MAX_AMOUNT,
            AuthorityTier::Trusted => TIER_3_MAX_AMOUNT,
        };
        require!(
            params.amount_limit <= tier_max,
            PactyraError::AmountExceedsTier
        );

        // Verify bond is satisfied
        require!(
            agent.bond_amount >= policy.min_bond_usdc,
            PactyraError::BondNotSatisfied
        );

        let capability_id = {
            let mut hash_data = Vec::new();
            hash_data.extend_from_slice(&agent.agent_id);
            hash_data.extend_from_slice(&[params.capability_type as u8]);
            hash_data.extend_from_slice(params.target_program.as_ref());
            hash_data.extend_from_slice(params.target_account.as_ref());
            hash_data.extend_from_slice(&params.amount_limit.to_le_bytes());
            hash_data.extend_from_slice(&clock.unix_timestamp.to_le_bytes());
            let hash = anchor_lang::solana_program::keccak::hash(&hash_data);
            hash.to_bytes()
        };

        let capability = &mut ctx.accounts.capability;
        capability.capability_id = capability_id;
        capability.agent_id = agent.agent_id;
        capability.capability_type = params.capability_type;
        capability.target_program = params.target_program;
        capability.target_account = params.target_account;
        capability.amount_limit = params.amount_limit;
        capability.frequency_limit = params.frequency_limit;
        capability.use_count = 0;
        capability.expiry = clock.unix_timestamp + params.ttl_seconds;
        capability.policy_key = policy.key();
        capability.authority_epoch = agent.current_epoch;
        capability.nonce = clock.slot;
        capability.status = CapabilityStatus::Active;
        capability.bump = ctx.bumps.capability;

        emit!(CapabilityIssued {
            capability_id,
            agent_id: agent.agent_id,
            capability_type: params.capability_type,
            amount_limit: params.amount_limit,
            expiry: capability.expiry,
            authority_epoch: capability.authority_epoch,
            slot: clock.slot,
        });
        Ok(())
    }

    /// Assert that a capability is valid for the requested action.
    /// This is the core enforcement instruction with all security checks.
    pub fn assert_capability(ctx: Context<AssertCapability>, action: ActionParams) -> Result<()> {
        let agent = &ctx.accounts.agent;
        let policy = &ctx.accounts.policy;
        let clock = Clock::get()?;

        // Check 1: Agent must be active
        require!(
            agent.status == AgentStatus::Active,
            PactyraError::AgentNotActive
        );

        // Check 2: Capability must be active
        require!(
            ctx.accounts.capability.status == CapabilityStatus::Active,
            PactyraError::CapabilityNotActive
        );

        // Check 3: Capability must belong to this agent
        require!(
            ctx.accounts.capability.agent_id == agent.agent_id,
            PactyraError::CapabilityAgentMismatch
        );

        // Check 4: Authority epoch must be current
        require!(
            ctx.accounts.capability.authority_epoch == agent.current_epoch,
            PactyraError::StaleEpoch
        );

        // Check 5: Policy must match
        require!(
            ctx.accounts.capability.policy_key == policy.key(),
            PactyraError::PolicyMismatch
        );

        // Check 6: Policy must be active
        require!(
            policy.status == PolicyStatus::Active,
            PactyraError::PolicySuperseded
        );

        // Check 7: Capability must not be expired
        require!(
            clock.unix_timestamp < ctx.accounts.capability.expiry,
            PactyraError::CapabilityExpired
        );

        // Check 8: Action type must match capability
        require!(
            ctx.accounts.capability.capability_type == action.action_type,
            PactyraError::ActionTypeNotPermitted
        );

        // Check 9: Target program must match
        require!(
            ctx.accounts.capability.target_program == action.target_program,
            PactyraError::TargetProgramMismatch
        );

        // Check 10: Target account must match
        require!(
            ctx.accounts.capability.target_account == action.target_account,
            PactyraError::TargetNotInScope
        );

        // Check 11: Amount must be within limit
        require!(
            action.amount <= ctx.accounts.capability.amount_limit,
            PactyraError::AmountExceedsCapability
        );

        // Check 12: Bond must be satisfied
        require!(
            agent.bond_amount >= policy.min_bond_usdc,
            PactyraError::BondNotSatisfied
        );

        // Check 13: Frequency limit enforcement — capability has a max use count
        require!(
            ctx.accounts.capability.use_count < ctx.accounts.capability.frequency_limit,
            PactyraError::FrequencyLimitExceeded
        );

        // Check 14: Delegate scope enforcement.
        // If the signer is the authority_root, delegate_scope is not required.
        // If the signer is NOT the authority_root, a valid DelegateScope must
        // exist and match the signer as the delegate.
        let signer_key = ctx.accounts.signer.key();
        let is_authority_root = signer_key == agent.authority_root;

        if !is_authority_root {
            // Signer is a delegate — the DelegateScope must exist and be valid.
            // The account constraint on `agent` already ensures the delegate
            // matches, but we still need to check expiry and amount limit.
            let delegate_scope_info = ctx
                .accounts
                .delegate_scope
                .as_ref()
                .ok_or(PactyraError::WrongAgent)?;
            let ds_data = delegate_scope_info.try_borrow_data()?;
            let ds: &DelegateScope = &DelegateScope::try_deserialize(&mut ds_data.as_ref())
                .map_err(|_| PactyraError::WrongAgent)?;
            require!(
                ds.delegate == signer_key,
                PactyraError::WrongAgent
            );
            require!(
                clock.unix_timestamp < ds.expires_at,
                PactyraError::DelegateScopeExpired
            );
            require!(
                action.amount <= ds.max_amount_per_action,
                PactyraError::DelegateAmountExceedsScope
            );
        }
        // If is_authority_root is true, no delegate scope checks needed —
        // the authority_root has full authority and delegate_scope can be None.

        // Mark nonce as consumed (replay protection via PDA init)
        let consumed_nonce = &mut ctx.accounts.consumed_nonce;
        consumed_nonce.agent_id = agent.agent_id;
        consumed_nonce.nonce = action.action_nonce;
        consumed_nonce.consumed_at = clock.unix_timestamp;
        consumed_nonce.bump = ctx.bumps.consumed_nonce;

        // Increment the capability use count (frequency limit enforcement)
        ctx.accounts.capability.use_count += 1;

        // Compute deterministic action_id binding this assertion to its exact
        // action parameters. record_outcome recomputes this hash and requires
        // it to match the Execution PDA's stored action_id — preventing the
        // verifier from recording outcomes for actions that never happened.
        let action_id = {
            let mut hash_data = Vec::new();
            hash_data.extend_from_slice(&agent.agent_id);
            hash_data.extend_from_slice(&ctx.accounts.capability.capability_id);
            hash_data.extend_from_slice(&[action.action_type as u8]);
            hash_data.extend_from_slice(action.target_program.as_ref());
            hash_data.extend_from_slice(action.target_account.as_ref());
            hash_data.extend_from_slice(&action.amount.to_le_bytes());
            hash_data.extend_from_slice(&action.action_nonce.to_le_bytes());
            let hash = anchor_lang::solana_program::keccak::hash(&hash_data);
            hash.to_bytes()
        };

        // Initialize the Execution PDA — binds this assertion to the actual
        // on-chain action. The target program must call mark_executed before
        // record_outcome can consume this Execution.
        let execution = &mut ctx.accounts.execution;
        execution.action_id = action_id;
        execution.agent_id = agent.agent_id;
        execution.capability_id = ctx.accounts.capability.capability_id;
        execution.action_type = action.action_type;
        execution.target_program = action.target_program;
        execution.target_account = action.target_account;
        execution.amount = action.amount;
        execution.action_nonce = action.action_nonce;
        execution.authority_epoch = agent.current_epoch;
        execution.asserted_at = clock.unix_timestamp;
        execution.executed_at = 0;
        execution.status = ExecutionStatus::Asserted;
        execution.bump = ctx.bumps.execution;

        emit!(CapabilityAsserted {
            agent_id: agent.agent_id,
            capability_id: ctx.accounts.capability.capability_id,
            action_type: action.action_type,
            amount: action.amount,
            action_nonce: action.action_nonce,
            result: true,
            slot: clock.slot,
        });

        emit!(ExecutionAsserted {
            action_id,
            agent_id: agent.agent_id,
            capability_id: ctx.accounts.capability.capability_id,
            target_program: action.target_program,
            action_nonce: action.action_nonce,
            slot: clock.slot,
        });
        Ok(())
    }

    /// Mark an asserted Execution as executed.
    ///
    /// Called via CPI by the target program (the program stored in
    /// `execution.target_program`) immediately after it applies the
    /// action's on-chain effects — for example, after the reference-treasury
    /// transfers USDC to the recipient.
    ///
    /// Security: The `executor` signer must equal `execution.target_program`.
    /// In a CPI call the calling program's ID is automatically a signer, so
    /// only the intended target program can advance an Execution from
    /// `Asserted` to `Executed`. This is the cryptographic binding between
    /// a capability assertion and the actual on-chain action.
    pub fn mark_executed(ctx: Context<MarkExecuted>) -> Result<()> {
        let execution = &mut ctx.accounts.execution;
        let clock = Clock::get()?;

        require!(
            execution.status == ExecutionStatus::Asserted,
            PactyraError::ExecutionAlreadyRecorded
        );

        // Only the target program stored in the Execution can mark it executed.
        // The CPI caller (target program) signs for itself automatically.
        require!(
            ctx.accounts.executor.key() == execution.target_program,
            PactyraError::UnauthorizedExecutionMarker
        );

        execution.status = ExecutionStatus::Executed;
        execution.executed_at = clock.unix_timestamp;

        emit!(ExecutionMarked {
            action_id: execution.action_id,
            agent_id: execution.agent_id,
            executor: ctx.accounts.executor.key(),
            executed_at: execution.executed_at,
            slot: clock.slot,
        });
        Ok(())
    }

    /// Register a verifier in the registry.
    /// Only the protocol authority can call this.
    pub fn register_verifier(
        ctx: Context<RegisterVerifier>,
        verifier_id: [u8; 32],
        verifier_program: Pubkey,
        operator_key: Pubkey,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.verifier_registry;
        let clock = Clock::get()?;

        require!(
            registry.authority == ctx.accounts.authority.key(),
            PactyraError::UnauthorizedVerifier
        );

        registry.verifiers.push(VerifierEntry {
            verifier_id,
            verifier_program,
            operator_key,
            active: true,
            registered_slot: clock.slot,
        });

        emit!(VerifierRegistered {
            verifier_id,
            verifier_program,
            operator_key,
            slot: clock.slot,
        });
        Ok(())
    }

    /// Record a performance outcome from a registered verifier.
    /// Updates agent counters and triggers authority transitions.
    ///
    /// Security:
    /// 1. The call MUST come through the registered verifier_program via CPI.
    ///    A verifier operator cannot bypass the objective verifier path by
    ///    calling record_outcome directly — the verifier_program account must
    ///    be a CPI signer and must match the registered verifier_program.
    /// 2. The verifier cannot fabricate outcomes for actions that never
    ///    happened — the Execution PDA must exist, be in `Executed` status,
    ///    and its stored action_id must equal the action_id argument.
    ///    This cryptographically binds the receipt to an on-chain action
    ///    that was authorized via `assert_capability` and subsequently
    ///    marked executed by the target program via `mark_executed`.
    pub fn record_outcome(
        ctx: Context<RecordOutcome>,
        action_id: [u8; 32],
        capability_id: [u8; 32],
        result: OutcomeResult,
        severity: Severity,
        evidence_hash: [u8; 32],
    ) -> Result<()> {
        let registry = &ctx.accounts.verifier_registry;
        let operator = ctx.accounts.verifier_operator.key();
        let verifier_program = ctx.accounts.verifier_program.key();
        let clock = Clock::get()?;

        // Verify the operator AND verifier_program are both registered and active.
        // This enforces that the call must come through the registered verifier
        // program — the operator cannot bypass the verifier by calling directly.
        let mut verifier_found = false;
        for entry in &registry.verifiers {
            if entry.operator_key == operator
                && entry.active
                && entry.verifier_program == verifier_program
            {
                verifier_found = true;
                break;
            }
        }
        require!(verifier_found, PactyraError::UnauthorizedVerifier);

        let agent = &mut ctx.accounts.agent;
        let policy = &ctx.accounts.policy;
        let execution = &mut ctx.accounts.execution;

        // Verify the Execution PDA corresponds to the claimed action.
        // The action_id passed in must equal the action_id stored in the
        // Execution PDA — this binds the receipt to the actual asserted
        // and executed action, preventing fabrication.
        require!(
            execution.action_id == action_id,
            PactyraError::ExecutionActionMismatch
        );
        require!(
            execution.agent_id == agent.agent_id,
            PactyraError::CapabilityAgentMismatch
        );
        require!(
            execution.capability_id == capability_id,
            PactyraError::PolicyMismatch
        );

        // The Execution must have been marked Executed by the target program.
        // Outcomes cannot be recorded for actions that were only asserted
        // (and never actually executed on-chain).
        require!(
            execution.status == ExecutionStatus::Executed,
            PactyraError::ExecutionNotExecuted
        );

        // T13 Mitigation: Verify evidence_hash is non-zero
        // The evidence_hash must be the keccak256 of the actual Pyth account data.
        // While we can't re-read Pyth data in this instruction (it's in pactyra-verifier),
        // we enforce that the hash is non-zero and stored onchain for independent verification.
        // The pactyra_verifier's verify_and_record instruction computes the hash from
        // real Pyth account data before CPI-ing here.
        require!(evidence_hash != [0u8; 32], PactyraError::InvalidEvidence);

        // Create the receipt
        let receipt = &mut ctx.accounts.receipt;
        receipt.receipt_id = action_id;
        receipt.agent_id = agent.agent_id;
        receipt.action_id = action_id;
        receipt.capability_id = capability_id;
        receipt.policy_key = policy.key();
        receipt.verifier = operator;
        receipt.result = result;
        receipt.severity = severity;
        receipt.evidence_hash = evidence_hash;
        receipt.timestamp = clock.unix_timestamp;
        receipt.authority_epoch = agent.current_epoch;
        receipt.bump = ctx.bumps.receipt;

        // Update agent counters
        agent.total_count += 1;
        let is_pass = result == OutcomeResult::Pass;
        if is_pass {
            agent.success_count += 1;
        }

        // Handle critical failure: slash bond, downgrade, epoch++
        let is_critical = result == OutcomeResult::Fail && severity == Severity::Critical;

        if is_critical {
            agent.critical_failures += 1;

            // Slash bond — transfer real USDC to slash destination.
            let bond = &mut ctx.accounts.bond;
            // Bond, bond_vault, and slash_destination are now mandatory
            // (not Optional), so the real token transfer always executes.
            if !bond.slashed {
                bond.slashed = true;
                let slashed_amount = bond.amount;
                bond.amount = 0;

                // Transfer real USDC from bond vault to slash destination
                if slashed_amount > 0 {
                    let bond_vault = &ctx.accounts.bond_vault;
                    let slash_destination = &ctx.accounts.slash_destination;
                    let signer_seeds = &[
                        b"bond_vault".as_ref(),
                        bond_vault.mint.as_ref(),
                        &[ctx.bumps.bond_vault],
                    ];
                    let signer = &[&signer_seeds[..]];

                    let cpi_accounts = Transfer {
                        from: bond_vault.to_account_info(),
                        to: slash_destination.to_account_info(),
                        authority: bond_vault.to_account_info(),
                    };
                    let cpi_program = ctx.accounts.token_program.to_account_info();
                    token::transfer(
                        CpiContext::new_with_signer(cpi_program, cpi_accounts, signer),
                        slashed_amount,
                    )?;
                }

                emit!(BondSlashed {
                    agent_id: agent.agent_id,
                    amount: slashed_amount,
                    slot: clock.slot,
                });
            }
            agent.bond_amount = 0;

            // Downgrade to Probation
            let old_tier = agent.tier;
            agent.tier = AuthorityTier::Probation;

            // Increment epoch — invalidates all outstanding capabilities
            agent.current_epoch += 1;

            emit!(AuthorityDowngraded {
                agent_id: agent.agent_id,
                old_tier,
                new_tier: AuthorityTier::Probation,
                new_epoch: agent.current_epoch,
                slot: clock.slot,
            });
        } else if is_pass {
            // Check for authority upgrade
            let old_tier = agent.tier;

            // T1 -> T2: after 5 verified successes (protocol constant)
            if agent.tier == AuthorityTier::Probation && agent.success_count >= T1_TO_T2_THRESHOLD {
                agent.tier = AuthorityTier::Proven;
                emit!(AuthorityUpgraded {
                    agent_id: agent.agent_id,
                    old_tier,
                    new_tier: AuthorityTier::Proven,
                    new_epoch: agent.current_epoch,
                    success_count: agent.success_count,
                    slot: clock.slot,
                });
            }

            // T2 -> T3: after 20+ successes, 95% rate, 0 critical failures, bond satisfied
            if agent.tier == AuthorityTier::Proven
                && agent.success_count >= policy.min_successes
                && agent.critical_failures <= policy.critical_failure_limit
                && agent.bond_amount >= policy.min_bond_usdc
            {
                let success_rate_bps = if agent.total_count > 0 {
                    ((agent.success_count as u128 * 10000) / agent.total_count as u128) as u16
                } else {
                    0
                };

                if success_rate_bps >= policy.min_success_rate_bps {
                    agent.tier = AuthorityTier::Trusted;
                    emit!(AuthorityUpgraded {
                        agent_id: agent.agent_id,
                        old_tier,
                        new_tier: AuthorityTier::Trusted,
                        new_epoch: agent.current_epoch,
                        success_count: agent.success_count,
                        slot: clock.slot,
                    });
                }
            }
        }

        emit!(OutcomeRecorded {
            receipt_id: action_id,
            agent_id: agent.agent_id,
            result,
            severity,
            verifier: operator,
            slot: clock.slot,
        });

        // Finalize the Execution lifecycle — no further updates allowed.
        execution.status = ExecutionStatus::Recorded;

        emit!(ExecutionRecorded {
            action_id,
            agent_id: agent.agent_id,
            receipt: receipt.key(),
            slot: clock.slot,
        });
        Ok(())
    }

    /// Revoke a capability. Only the agent's authority root can call this.
    pub fn revoke_capability(ctx: Context<RevokeCapability>) -> Result<()> {
        let capability = &mut ctx.accounts.capability;
        let clock = Clock::get()?;

        capability.status = CapabilityStatus::Revoked;

        emit!(CapabilityRevoked {
            capability_id: capability.capability_id,
            agent_id: capability.agent_id,
            slot: clock.slot,
        });
        Ok(())
    }

    // ============================================================
    // Governance Layer Instructions
    // ============================================================

    /// Grant a delegate (session key) with bounded scope.
    pub fn delegate_authority(
        ctx: Context<DelegateAuthority>,
        delegate: Pubkey,
        max_amount_per_action: u64,
        expires_in_seconds: i64,
    ) -> Result<()> {
        let agent = &ctx.accounts.agent;
        let clock = Clock::get()?;

        let scope = &mut ctx.accounts.delegate_scope;
        scope.agent_id = agent.agent_id;
        scope.delegate = delegate;
        scope.max_amount_per_action = max_amount_per_action;
        scope.expires_at = clock.unix_timestamp + expires_in_seconds;
        scope.bump = ctx.bumps.delegate_scope;

        emit!(DelegateGranted {
            agent_id: agent.agent_id,
            delegate,
            max_amount_per_action,
            expires_at: scope.expires_at,
            slot: clock.slot,
        });
        Ok(())
    }

    /// Revoke a delegate (session key).
    pub fn revoke_delegate(ctx: Context<RevokeDelegate>) -> Result<()> {
        let scope = &mut ctx.accounts.delegate_scope;
        let clock = Clock::get()?;
        scope.expires_at = clock.unix_timestamp;

        emit!(DelegateRevoked {
            agent_id: scope.agent_id,
            delegate: scope.delegate,
            slot: clock.slot,
        });
        Ok(())
    }

    /// Freeze an agent — prevents all future capability assertions.
    pub fn freeze_agent(ctx: Context<FreezeAgent>) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        let clock = Clock::get()?;
        agent.status = AgentStatus::Frozen;

        emit!(AgentFrozen {
            agent_id: agent.agent_id,
            slot: clock.slot,
        });
        Ok(())
    }

    /// Unfreeze an agent — restores active status.
    pub fn unfreeze_agent(ctx: Context<FreezeAgent>) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        let clock = Clock::get()?;
        agent.status = AgentStatus::Active;

        emit!(AgentUnfrozen {
            agent_id: agent.agent_id,
            slot: clock.slot,
        });
        Ok(())
    }

    /// Supersede a policy — marks it as superseded and points to the new policy.
    pub fn supersede_policy(ctx: Context<SupersedePolicy>) -> Result<()> {
        let old_policy = &mut ctx.accounts.old_policy;
        let new_policy = &ctx.accounts.new_policy;
        let clock = Clock::get()?;

        require!(
            old_policy.status == PolicyStatus::Active,
            PactyraError::PolicyAlreadySuperseded
        );

        old_policy.status = PolicyStatus::Superseded;
        old_policy.superseded_by = Some(new_policy.policy_id);

        emit!(PolicySuperseded {
            old_policy_id: old_policy.policy_id,
            new_policy_id: new_policy.policy_id,
            slot: clock.slot,
        });
        Ok(())
    }

    /// Deprecate a verifier — marks it as inactive in the registry.
    pub fn deprecate_verifier(ctx: Context<DeprecateVerifier>, verifier_index: u8) -> Result<()> {
        let registry = &mut ctx.accounts.verifier_registry;
        let clock = Clock::get()?;

        require!(
            verifier_index < registry.verifiers.len() as u8,
            PactyraError::VerifierNotActive
        );

        registry.verifiers[verifier_index as usize].active = false;

        let verifier_id = registry.verifiers[verifier_index as usize].verifier_id;
        emit!(VerifierDeprecated {
            verifier_id,
            slot: clock.slot,
        });
        Ok(())
    }

    /// Replace the protocol authority — transfers control of the VerifierRegistry.
    pub fn replace_protocol_authority(
        ctx: Context<ReplaceProtocolAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.verifier_registry;
        let clock = Clock::get()?;

        registry.authority = new_authority;

        emit!(ProtocolAuthorityReplaced {
            new_authority,
            slot: clock.slot,
        });
        Ok(())
    }

    /// Propose a timelocked trust-root operation.
    /// The operation can only be executed after TIMELOCK_DELAY_SECONDS.
    pub fn propose_operation(ctx: Context<ProposeOperation>, operation_type: u8) -> Result<()> {
        let clock = Clock::get()?;
        let op = &mut ctx.accounts.operation;

        op.operation_type = operation_type;
        op.proposer = ctx.accounts.authority.key();
        op.proposed_at = clock.unix_timestamp;
        op.execute_after = clock.unix_timestamp + TIMELOCK_DELAY_SECONDS;
        op.executed = false;
        op.cancelled = false;
        op.bump = ctx.bumps.operation;

        emit!(OperationProposed {
            operation_type,
            proposer: ctx.accounts.authority.key(),
            execute_after: op.execute_after,
            slot: clock.slot,
        });
        Ok(())
    }

    /// Execute a timelocked operation after the delay has passed.
    pub fn execute_operation(ctx: Context<ExecuteOperation>) -> Result<()> {
        let op = &mut ctx.accounts.operation;
        let clock = Clock::get()?;

        require!(!op.cancelled, PactyraError::OperationCancelled);
        require!(!op.executed, PactyraError::OperationAlreadyExecuted);
        require!(
            clock.unix_timestamp >= op.execute_after,
            PactyraError::TimelockNotExpired
        );

        op.executed = true;

        emit!(OperationExecuted {
            operation_type: op.operation_type,
            proposer: op.proposer,
            slot: clock.slot,
        });
        Ok(())
    }

    /// Cancel a proposed timelocked operation (only proposer can cancel).
    pub fn cancel_operation(ctx: Context<CancelOperation>) -> Result<()> {
        let op = &mut ctx.accounts.operation;
        let clock = Clock::get()?;

        require!(
            op.proposer == ctx.accounts.proposer.key(),
            PactyraError::UnauthorizedCancellation
        );
        require!(!op.executed, PactyraError::OperationAlreadyExecuted);

        op.cancelled = true;

        emit!(OperationCancelled {
            operation_type: op.operation_type,
            slot: clock.slot,
        });
        Ok(())
    }

    /// Close a receipt account and reclaim rent.
    /// Only the agent's authority root can close receipts.
    /// Receipts can only be closed after the authority epoch has advanced
    /// (ensuring they are historical, not active evidence).
    pub fn close_receipt(ctx: Context<CloseReceipt>) -> Result<()> {
        let receipt = &ctx.accounts.receipt;
        let agent = &ctx.accounts.agent;
        let clock = Clock::get()?;

        // Verify the receipt belongs to this agent
        require!(
            receipt.agent_id == agent.agent_id,
            PactyraError::CapabilityAgentMismatch
        );

        // Verify the receipt is from a prior epoch (not the current one)
        // This ensures active evidence cannot be destroyed
        require!(
            receipt.authority_epoch < agent.current_epoch,
            PactyraError::ReceiptFromCurrentEpoch
        );

        emit!(ReceiptClosed {
            receipt_id: receipt.receipt_id,
            agent_id: receipt.agent_id,
            authority_epoch: receipt.authority_epoch,
            slot: clock.slot,
        });

        // Close the account — rent goes to the authority root
        let receipt_info = receipt.to_account_info();
        let authority_lamports = ctx.accounts.authority_root.to_account_info();
        **authority_lamports.lamports.borrow_mut() += receipt_info.lamports();
        **receipt_info.lamports.borrow_mut() = 0;

        Ok(())
    }
}

// ============================================================
// Account Contexts
// ============================================================

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + VerifierRegistry::INIT_SPACE,
        seeds = [b"verifier_registry"],
        bump
    )]
    pub verifier_registry: Account<'info, VerifierRegistry>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent_id: [u8; 32])]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Agent::INIT_SPACE,
        seeds = [b"agent", agent_id.as_ref()],
        bump
    )]
    pub agent: Account<'info, Agent>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(params: CreatePolicyParams)]
pub struct CreatePolicy<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Policy::INIT_SPACE,
        seeds = [b"policy", params.version_tag.as_bytes()],
        bump
    )]
    pub policy: Account<'info, Policy>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LockBond<'info> {
    #[account(
        mut,
        has_one = authority_root
    )]
    pub agent: Account<'info, Agent>,

    #[account(
        init_if_needed,
        payer = authority_root,
        space = 8 + Bond::INIT_SPACE,
        seeds = [b"bond", agent.agent_id.as_ref()],
        bump
    )]
    pub bond: Account<'info, Bond>,

    #[account(
        mut,
        constraint = agent_token.mint == usdc_mint.key()
    )]
    pub agent_token: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = authority_root,
        seeds = [b"bond_vault", usdc_mint.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = bond_vault,
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority_root: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(params: RequestCapabilityParams)]
pub struct RequestCapability<'info> {
    #[account(has_one = authority_root)]
    pub agent: Account<'info, Agent>,

    pub policy: Account<'info, Policy>,

    #[account(
        init,
        payer = authority_root,
        space = 8 + Capability::INIT_SPACE,
        seeds = [b"capability", agent.agent_id.as_ref(), agent.current_epoch.to_le_bytes().as_ref(), params.target_program.as_ref()],
        bump
    )]
    pub capability: Account<'info, Capability>,

    #[account(mut)]
    pub authority_root: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(action: ActionParams)]
pub struct AssertCapability<'info> {
    #[account(
        constraint = agent.authority_root == signer.key()
            || delegate_scope.is_some(),
    )]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
        constraint = capability.agent_id == agent.agent_id,
    )]
    pub capability: Account<'info, Capability>,

    #[account(
        constraint = policy.key() == capability.policy_key
    )]
    pub policy: Account<'info, Policy>,

    #[account(
        init,
        payer = signer,
        space = 8 + ConsumedNonce::INIT_SPACE,
        seeds = [b"nonce", agent.agent_id.as_ref(), action.action_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub consumed_nonce: Account<'info, ConsumedNonce>,

    /// Execution PDA — binds this capability assertion to the actual on-chain
    /// action. Seeds: [b"execution", agent_id, action_nonce]. The action_nonce
    /// ties the Execution to the same nonce used for replay protection.
    #[account(
        init,
        payer = signer,
        space = 8 + Execution::INIT_SPACE,
        seeds = [b"execution", agent.agent_id.as_ref(), action.action_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub execution: Account<'info, Execution>,

    /// Optional: if a delegate (session key) is signing instead of the authority
    /// root, this account must exist and be valid. When authority_root signs,
    /// this account is not required and can be None.
    /// CHECK: Validated manually in the instruction body.
    pub delegate_scope: Option<UncheckedAccount<'info>>,

    /// The signer — either the agent's authority_root (direct execution)
    /// or a delegated session key (delegated execution).
    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MarkExecuted<'info> {
    /// The Execution PDA to advance from Asserted -> Executed.
    /// Seeds: [b"execution", agent_id, action_nonce]
    #[account(
        mut,
        seeds = [b"execution", execution.agent_id.as_ref(), execution.action_nonce.to_le_bytes().as_ref()],
        bump = execution.bump,
    )]
    pub execution: Account<'info, Execution>,

    /// The target program that is authorized to mark this Execution as executed.
    /// In a CPI call the calling program's ID is automatically a signer, so
    /// only the intended target program can satisfy this check. The address
    /// constraint verifies it matches execution.target_program.
    /// CHECK: Address verified against execution.target_program.
    #[account(
        signer,
        address = execution.target_program,
    )]
    pub executor: Signer<'info>,
}

#[derive(Accounts)]
pub struct RegisterVerifier<'info> {
    #[account(mut,
        seeds = [b"verifier_registry"],
        bump = verifier_registry.bump,
        has_one = authority
    )]
    pub verifier_registry: Account<'info, VerifierRegistry>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(action_id: [u8; 32])]
pub struct RecordOutcome<'info> {
    #[account(
        mut,
        seeds = [b"agent", agent.agent_id.as_ref()],
        bump = agent.bump,
    )]
    pub agent: Account<'info, Agent>,

    #[account(
        init,
        payer = verifier_operator,
        space = 8 + Receipt::INIT_SPACE,
        seeds = [b"receipt", agent.agent_id.as_ref(), action_id.as_ref()],
        bump
    )]
    pub receipt: Account<'info, Receipt>,

    #[account(seeds = [b"verifier_registry"], bump = verifier_registry.bump)]
    pub verifier_registry: Account<'info, VerifierRegistry>,

    pub policy: Account<'info, Policy>,

    /// The Execution PDA that binds this receipt to an actual on-chain action.
    /// Seeds: [b"execution", agent_id, action_nonce]. The action_id argument
    /// is verified against execution.action_id in the instruction body.
    #[account(
        mut,
        seeds = [b"execution", agent.agent_id.as_ref(), execution.action_nonce.to_le_bytes().as_ref()],
        bump = execution.bump,
    )]
    pub execution: Account<'info, Execution>,

    #[account(
        mut,
        seeds = [b"bond", agent.agent_id.as_ref()],
        bump = bond.bump,
    )]
    pub bond: Account<'info, Bond>,

    /// Bond vault token account — mandatory for real USDC slash transfer.
    /// The vault PDA holds the escrowed USDC. On critical failure, the
    /// slashed amount is transferred from this vault to the slash destination.
    /// CHECK: Verified via seeds and token constraints.
    #[account(
        mut,
        seeds = [b"bond_vault", usdc_mint.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = bond_vault,
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    /// Slash destination token account — receives the slashed USDC on
    /// critical failure. Must be provided so the real token transfer
    /// always executes when a bond is slashed.
    #[account(
        mut,
        constraint = slash_destination.mint == usdc_mint.key()
    )]
    pub slash_destination: Account<'info, TokenAccount>,

    /// The verifier program that is calling this instruction via CPI.
    /// Must be a registered verifier_program in the VerifierRegistry and must
    /// be a CPI signer — this enforces that the operator cannot bypass the
    /// objective verifier path by calling record_outcome directly.
    /// CHECK: Verified against the registry in the instruction body.
    #[account(signer)]
    pub verifier_program: UncheckedAccount<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub verifier_operator: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeCapability<'info> {
    #[account(has_one = authority_root)]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
        constraint = capability.agent_id == agent.agent_id,
    )]
    pub capability: Account<'info, Capability>,

    #[account(mut)]
    pub authority_root: Signer<'info>,
}

// ============================================================
// Governance Layer Account Contexts
// ============================================================

#[derive(Accounts)]
pub struct DelegateAuthority<'info> {
    #[account(has_one = authority_root)]
    pub agent: Account<'info, Agent>,

    #[account(
        init,
        payer = authority_root,
        space = 8 + DelegateScope::INIT_SPACE,
        seeds = [b"delegate_scope", agent.agent_id.as_ref()],
        bump
    )]
    pub delegate_scope: Account<'info, DelegateScope>,

    #[account(mut)]
    pub authority_root: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeDelegate<'info> {
    #[account(has_one = authority_root)]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
        seeds = [b"delegate_scope", agent.agent_id.as_ref()],
        bump = delegate_scope.bump,
    )]
    pub delegate_scope: Account<'info, DelegateScope>,

    #[account(mut)]
    pub authority_root: Signer<'info>,
}

#[derive(Accounts)]
pub struct FreezeAgent<'info> {
    #[account(
        mut,
        has_one = authority_root
    )]
    pub agent: Account<'info, Agent>,

    #[account(mut)]
    pub authority_root: Signer<'info>,
}

#[derive(Accounts)]
pub struct SupersedePolicy<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub old_policy: Account<'info, Policy>,

    pub new_policy: Account<'info, Policy>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeprecateVerifier<'info> {
    #[account(mut,
        seeds = [b"verifier_registry"],
        bump = verifier_registry.bump,
        has_one = authority
    )]
    pub verifier_registry: Account<'info, VerifierRegistry>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ReplaceProtocolAuthority<'info> {
    #[account(mut,
        seeds = [b"verifier_registry"],
        bump = verifier_registry.bump,
        has_one = authority
    )]
    pub verifier_registry: Account<'info, VerifierRegistry>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(operation_type: u8)]
pub struct ProposeOperation<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TimelockedOperation::INIT_SPACE,
        seeds = [b"timelocked_op", authority.key().as_ref(), &[operation_type]],
        bump
    )]
    pub operation: Account<'info, TimelockedOperation>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteOperation<'info> {
    #[account(mut)]
    pub operation: Account<'info, TimelockedOperation>,
}

#[derive(Accounts)]
pub struct CancelOperation<'info> {
    #[account(mut)]
    pub operation: Account<'info, TimelockedOperation>,

    #[account(mut)]
    pub proposer: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseReceipt<'info> {
    #[account(has_one = authority_root)]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
        close = authority_root,
    )]
    pub receipt: Account<'info, Receipt>,

    #[account(mut)]
    pub authority_root: Signer<'info>,
}

#[event]
pub struct ProtocolInitialized {
    pub authority: Pubkey,
    pub slot: u64,
}

#[event]
pub struct AgentRegistered {
    pub agent_id: [u8; 32],
    pub authority_root: Pubkey,
    pub slot: u64,
}

#[event]
pub struct PolicyCreated {
    pub policy_id: [u8; 32],
    pub version_tag: String,
    pub authority: Pubkey,
    pub slot: u64,
}

#[event]
pub struct BondLocked {
    pub agent_id: [u8; 32],
    pub amount: u64,
    pub slot: u64,
}

#[event]
pub struct CapabilityIssued {
    pub capability_id: [u8; 32],
    pub agent_id: [u8; 32],
    pub capability_type: CapabilityType,
    pub amount_limit: u64,
    pub expiry: i64,
    pub authority_epoch: u64,
    pub slot: u64,
}

#[event]
pub struct CapabilityAsserted {
    pub agent_id: [u8; 32],
    pub capability_id: [u8; 32],
    pub action_type: CapabilityType,
    pub amount: u64,
    pub action_nonce: u64,
    pub result: bool,
    pub slot: u64,
}

#[event]
pub struct VerifierRegistered {
    pub verifier_id: [u8; 32],
    pub verifier_program: Pubkey,
    pub operator_key: Pubkey,
    pub slot: u64,
}

#[event]
pub struct OutcomeRecorded {
    pub receipt_id: [u8; 32],
    pub agent_id: [u8; 32],
    pub result: OutcomeResult,
    pub severity: Severity,
    pub verifier: Pubkey,
    pub slot: u64,
}

#[event]
pub struct AuthorityUpgraded {
    pub agent_id: [u8; 32],
    pub old_tier: AuthorityTier,
    pub new_tier: AuthorityTier,
    pub new_epoch: u64,
    pub success_count: u64,
    pub slot: u64,
}

#[event]
pub struct AuthorityDowngraded {
    pub agent_id: [u8; 32],
    pub old_tier: AuthorityTier,
    pub new_tier: AuthorityTier,
    pub new_epoch: u64,
    pub slot: u64,
}

#[event]
pub struct BondSlashed {
    pub agent_id: [u8; 32],
    pub amount: u64,
    pub slot: u64,
}

#[event]
pub struct CapabilityRevoked {
    pub capability_id: [u8; 32],
    pub agent_id: [u8; 32],
    pub slot: u64,
}

// ============================================================
// Governance Layer Events
// ============================================================

#[event]
pub struct DelegateGranted {
    pub agent_id: [u8; 32],
    pub delegate: Pubkey,
    pub max_amount_per_action: u64,
    pub expires_at: i64,
    pub slot: u64,
}

#[event]
pub struct DelegateRevoked {
    pub agent_id: [u8; 32],
    pub delegate: Pubkey,
    pub slot: u64,
}

#[event]
pub struct AgentFrozen {
    pub agent_id: [u8; 32],
    pub slot: u64,
}

#[event]
pub struct AgentUnfrozen {
    pub agent_id: [u8; 32],
    pub slot: u64,
}

#[event]
pub struct PolicySuperseded {
    pub old_policy_id: [u8; 32],
    pub new_policy_id: [u8; 32],
    pub slot: u64,
}

#[event]
pub struct VerifierDeprecated {
    pub verifier_id: [u8; 32],
    pub slot: u64,
}

#[event]
pub struct ProtocolAuthorityReplaced {
    pub new_authority: Pubkey,
    pub slot: u64,
}

#[event]
pub struct OperationProposed {
    pub operation_type: u8,
    pub proposer: Pubkey,
    pub execute_after: i64,
    pub slot: u64,
}

#[event]
pub struct OperationExecuted {
    pub operation_type: u8,
    pub proposer: Pubkey,
    pub slot: u64,
}

#[event]
pub struct OperationCancelled {
    pub operation_type: u8,
    pub slot: u64,
}

#[event]
pub struct ReceiptClosed {
    pub receipt_id: [u8; 32],
    pub agent_id: [u8; 32],
    pub authority_epoch: u64,
    pub slot: u64,
}

// ============================================================
// Execution PDA Events
// ============================================================

/// Emitted when assert_capability initializes an Execution PDA with status=Asserted.
#[event]
pub struct ExecutionAsserted {
    pub action_id: [u8; 32],
    pub agent_id: [u8; 32],
    pub capability_id: [u8; 32],
    pub target_program: Pubkey,
    pub action_nonce: u64,
    pub slot: u64,
}

/// Emitted when the target program marks an Execution as Executed via mark_executed.
#[event]
pub struct ExecutionMarked {
    pub action_id: [u8; 32],
    pub agent_id: [u8; 32],
    pub executor: Pubkey,
    pub executed_at: i64,
    pub slot: u64,
}

/// Emitted when record_outcome finalizes an Execution to Recorded status.
#[event]
pub struct ExecutionRecorded {
    pub action_id: [u8; 32],
    pub agent_id: [u8; 32],
    pub receipt: Pubkey,
    pub slot: u64,
}
