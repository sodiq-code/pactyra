use anchor_lang::prelude::*;

declare_id!("EjF7VXPMk5bcDBVWfkcpN9sL93Srpo2y8zs7j7vedwSC");

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
    pub target_scope: [u8; 32],
    pub amount_limit: u64,
    pub frequency_limit: u64,
    pub expiry: i64,
    pub policy_hash: [u8; 32],
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
    pub policy_hash: [u8; 32],
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

/// Protocol error codes.
#[error_code]
pub enum PactyraError {
    #[msg("The agent is not active")]
    AgentNotActive,
    #[msg("The capability is not active")]
    CapabilityNotActive,
    #[msg("The authority epoch is stale")]
    StaleEpoch,
    #[msg("The policy hash does not match")]
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
}

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

    /// Assert that a capability is valid for the requested action.
    pub fn assert_capability(
        ctx: Context<AssertCapability>,
        action_hash: [u8; 32],
    ) -> Result<()> {
        let agent = &ctx.accounts.agent;
        let clock = Clock::get()?;
        require!(
            agent.status == AgentStatus::Active,
            PactyraError::AgentNotActive
        );
        emit!(CapabilityAsserted {
            agent_id: agent.agent_id,
            action_hash,
            result: true,
            slot: clock.slot,
        });
        Ok(())
    }
}

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
pub struct AssertCapability<'info> {
    #[account(has_one = authority_root)]
    pub agent: Account<'info, Agent>,

    #[account(signer)]
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
pub struct CapabilityAsserted {
    pub agent_id: [u8; 32],
    pub action_hash: [u8; 32],
    pub result: bool,
    pub slot: u64,
}
