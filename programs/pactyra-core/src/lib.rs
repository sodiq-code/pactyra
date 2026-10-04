use anchor_lang::prelude::*;

declare_id!("EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC");

// ============================================================
// Enums
// ============================================================

/// Authority tiers for agent economic access.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum AuthorityTier {
    Probation,
    Proven,
    Trusted,
}

impl Default for AuthorityTier {
    fn default() -> Self {
        AuthorityTier::Probation
    }
}

/// Agent status.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum AgentStatus {
    Active,
    Frozen,
}

impl Default for AgentStatus {
    fn default() -> Self {
        AgentStatus::Active
    }
}

/// Capability lifecycle status.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum CapabilityStatus {
    Active,
    Revoked,
    Expired,
}

impl Default for CapabilityStatus {
    fn default() -> Self {
        CapabilityStatus::Active
    }
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
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum PolicyStatus {
    Active,
    Superseded,
}

impl Default for PolicyStatus {
    fn default() -> Self {
        PolicyStatus::Active
    }
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
    pub fn create_policy(
        ctx: Context<CreatePolicy>,
        params: CreatePolicyParams,
    ) -> Result<()> {
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

    /// Lock a bond for an agent.
    /// Tracks the bond amount in the Agent and Bond accounts.
    pub fn lock_bond(ctx: Context<LockBond>, amount: u64) -> Result<()> {
        require!(amount > 0, PactyraError::InsufficientBond);

        let agent = &mut ctx.accounts.agent;
        let clock = Clock::get()?;

        // Update agent bond amount
        agent.bond_amount += amount;

        // Create bond record
        let bond = &mut ctx.accounts.bond;
        bond.agent_id = agent.agent_id;
        bond.amount = amount;
        bond.locked_at = clock.unix_timestamp;
        bond.slashed = false;
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

        // Verify bond is satisfied
        require!(
            agent.bond_amount >= policy.min_bond_usdc,
            PactyraError::BondNotSatisfied
        );

        let capability = &mut ctx.accounts.capability;

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

        capability.capability_id = capability_id;
        capability.agent_id = agent.agent_id;
        capability.capability_type = params.capability_type;
        capability.target_program = params.target_program;
        capability.target_account = params.target_account;
        capability.amount_limit = params.amount_limit;
        capability.frequency_limit = params.frequency_limit;
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
    pub fn assert_capability(
        ctx: Context<AssertCapability>,
        action: ActionParams,
    ) -> Result<()> {
        let agent = &ctx.accounts.agent;
        let capability = &ctx.accounts.capability;
        let policy = &ctx.accounts.policy;
        let clock = Clock::get()?;

        // Check 1: Agent must be active
        require!(
            agent.status == AgentStatus::Active,
            PactyraError::AgentNotActive
        );

        // Check 2: Capability must be active
        require!(
            capability.status == CapabilityStatus::Active,
            PactyraError::CapabilityNotActive
        );

        // Check 3: Capability must belong to this agent
        require!(
            capability.agent_id == agent.agent_id,
            PactyraError::CapabilityAgentMismatch
        );

        // Check 4: Authority epoch must be current
        require!(
            capability.authority_epoch == agent.current_epoch,
            PactyraError::StaleEpoch
        );

        // Check 5: Policy must match
        require!(
            capability.policy_key == policy.key(),
            PactyraError::PolicyMismatch
        );

        // Check 6: Policy must be active
        require!(
            policy.status == PolicyStatus::Active,
            PactyraError::PolicySuperseded
        );

        // Check 7: Capability must not be expired
        require!(
            clock.unix_timestamp < capability.expiry,
            PactyraError::CapabilityExpired
        );

        // Check 8: Action type must match capability
        require!(
            capability.capability_type == action.action_type,
            PactyraError::ActionTypeNotPermitted
        );

        // Check 9: Target program must match
        require!(
            capability.target_program == action.target_program,
            PactyraError::TargetProgramMismatch
        );

        // Check 10: Target account must match
        require!(
            capability.target_account == action.target_account,
            PactyraError::TargetNotInScope
        );

        // Check 11: Amount must be within limit
        require!(
            action.amount <= capability.amount_limit,
            PactyraError::AmountExceedsCapability
        );

        // Check 12: Bond must be satisfied
        require!(
            agent.bond_amount >= policy.min_bond_usdc,
            PactyraError::BondNotSatisfied
        );

        // Mark nonce as consumed (replay protection via PDA init)
        let consumed_nonce = &mut ctx.accounts.consumed_nonce;
        consumed_nonce.agent_id = agent.agent_id;
        consumed_nonce.nonce = action.action_nonce;
        consumed_nonce.consumed_at = clock.unix_timestamp;
        consumed_nonce.bump = ctx.bumps.consumed_nonce;

        emit!(CapabilityAsserted {
            agent_id: agent.agent_id,
            capability_id: capability.capability_id,
            action_type: action.action_type,
            amount: action.amount,
            action_nonce: action.action_nonce,
            result: true,
            slot: clock.slot,
        });
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
        init,
        payer = authority_root,
        space = 8 + Bond::INIT_SPACE,
        seeds = [b"bond", agent.agent_id.as_ref()],
        bump
    )]
    pub bond: Account<'info, Bond>,

    #[account(mut)]
    pub authority_root: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestCapability<'info> {
    #[account(has_one = authority_root)]
    pub agent: Account<'info, Agent>,

    pub policy: Account<'info, Policy>,

    #[account(
        init,
        payer = authority_root,
        space = 8 + Capability::INIT_SPACE,
        seeds = [b"capability", agent.agent_id.as_ref(), agent.current_epoch.to_le_bytes().as_ref()],
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
    #[account(has_one = authority_root)]
    pub agent: Account<'info, Agent>,

    #[account(
        constraint = capability.agent_id == agent.agent_id,
    )]
    pub capability: Account<'info, Capability>,

    #[account(
        constraint = policy.key() == capability.policy_key
    )]
    pub policy: Account<'info, Policy>,

    #[account(
        init,
        payer = authority_root,
        space = 8 + ConsumedNonce::INIT_SPACE,
        seeds = [b"nonce", agent.agent_id.as_ref(), action.action_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub consumed_nonce: Account<'info, ConsumedNonce>,

    #[account(mut)]
    pub authority_root: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================================
// Events
// ============================================================

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
