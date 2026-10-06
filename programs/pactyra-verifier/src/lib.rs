use anchor_lang::prelude::*;

declare_id!("5dK7xXDUSHDcP8qFxrLLFo4Nm2Xzn7rSKgDMmrFFLZsN");

/// Pyth Pull Oracle program on Solana (creates and owns PriceUpdateV2 accounts).
/// This is the real program ID on mainnet and devnet.
pub const PYTH_PULL_ORACLE_ID: Pubkey = pubkey!("pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT");

/// Verification result.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum VerificationResult {
    Pass,
    Fail,
}

/// Failure severity classification.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum FailureSeverity {
    Ordinary,
    Critical,
}

/// Pyth price freshness configuration.
#[account]
#[derive(InitSpace)]
pub struct FreshnessConfig {
    pub feed_id: [u8; 32],
    pub max_age_seconds: u64,
    pub critical_threshold_seconds: u64,
    pub authority: Pubkey,
    pub bump: u8,
}

/// Protocol error codes for the verifier.
#[error_code]
pub enum VerifierError {
    #[msg("The price update is too old")]
    PriceStale,
    #[msg("The feed ID does not match the configuration")]
    WrongFeed,
    #[msg("The price update account is not owned by Pyth")]
    WrongOwner,
    #[msg("The price is invalid")]
    InvalidPrice,
    #[msg("Unauthorized operator")]
    UnauthorizedOperator,
    #[msg("The price update account has insufficient data")]
    InsufficientData,
}

/// PriceUpdateV2 account data layout.
///
/// This mirrors Pyth's `PriceUpdateV2` account structure:
/// - 8 bytes: Anchor discriminator
/// - 32 bytes: write_authority (Pubkey)
/// - 1-2 bytes: verification_level (Borsh enum)
///   - Full: 1 byte (discriminant=1, no data)
///   - Partial: 2 bytes (discriminant=0, num_signatures: u8)
/// - 32 bytes: feed_id
/// - 8 bytes: price (i64)
/// - 8 bytes: conf (u64)
/// - 4 bytes: exponent (i32)
/// - 8 bytes: publish_time (i64)
/// - 8 bytes: prev_publish_time
/// - 8 bytes: ema_price
/// - 8 bytes: ema_conf
/// - 8 bytes: posted_slot
///
/// The verification_level enum is variable-length in Borsh, so we read
/// the discriminant first to determine the offset of subsequent fields.
const PRICE_UPDATE_DATA_OFFSET: usize = 8; // skip Anchor discriminator
const WRITE_AUTHORITY_OFFSET: usize = PRICE_UPDATE_DATA_OFFSET; // 8
const VERIFICATION_LEVEL_OFFSET: usize = WRITE_AUTHORITY_OFFSET + 32; // 40
const VERIFICATION_LEVEL_FULL: u8 = 1;
const VERIFICATION_LEVEL_PARTIAL: u8 = 0;

/// Compute the feed_id offset based on the verification_level discriminant.
fn feed_id_offset(data: &[u8]) -> Result<usize> {
    require!(
        data.len() > VERIFICATION_LEVEL_OFFSET,
        VerifierError::InsufficientData
    );
    let disc = data[VERIFICATION_LEVEL_OFFSET];
    let offset = match disc {
        VERIFICATION_LEVEL_FULL => VERIFICATION_LEVEL_OFFSET + 1,
        VERIFICATION_LEVEL_PARTIAL => VERIFICATION_LEVEL_OFFSET + 2,
        _ => return Err(VerifierError::InvalidPrice.into()),
    };
    Ok(offset)
}

/// Read the feed_id from a PriceUpdateV2 account's raw data.
fn read_feed_id(data: &[u8]) -> Result<[u8; 32]> {
    let offset = feed_id_offset(data)?;
    require!(
        data.len() >= offset + 32,
        VerifierError::InsufficientData
    );
    let mut feed_id = [0u8; 32];
    feed_id.copy_from_slice(&data[offset..offset + 32]);
    Ok(feed_id)
}

/// Read the publish_time from a PriceUpdateV2 account's raw data.
fn read_publish_time(data: &[u8]) -> Result<i64> {
    let feed_offset = feed_id_offset(data)?;
    let publish_time_offset = feed_offset + 32 + 8 + 8 + 4; // feed_id + price + conf + exponent
    require!(
        data.len() >= publish_time_offset + 8,
        VerifierError::InsufficientData
    );
    let bytes: [u8; 8] = data[publish_time_offset..publish_time_offset + 8]
        .try_into()
        .map_err(|_| VerifierError::InsufficientData)?;
    Ok(i64::from_le_bytes(bytes))
}

/// Verify that an account is owned by the Pyth Pull Oracle program.
fn verify_pyth_owner(account: &AccountInfo) -> Result<()> {
    require!(
        account.owner == &PYTH_PULL_ORACLE_ID,
        VerifierError::WrongOwner
    );
    Ok(())
}

#[program]
pub mod pactyra_verifier {
    use super::*;

    /// Initialize the freshness configuration for a feed.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        feed_id: [u8; 32],
        max_age_seconds: u64,
        critical_threshold_seconds: u64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.feed_id = feed_id;
        config.max_age_seconds = max_age_seconds;
        config.critical_threshold_seconds = critical_threshold_seconds;
        config.authority = ctx.accounts.authority.key();
        config.bump = ctx.bumps.config;
        emit!(ConfigInitialized {
            feed_id,
            max_age_seconds,
            critical_threshold_seconds,
            authority: ctx.accounts.authority.key(),
        });
        Ok(())
    }

    /// Verify a price update's freshness against the configuration.
    ///
    /// Reads the `publish_time` from the Pyth `PriceUpdateV2` account data
    /// and checks that the age is within `max_age_seconds`.
    ///
    /// Security checks:
    /// 1. Account owner must be the Pyth Pull Oracle program (prevents forged accounts)
    /// 2. Feed ID must match the configuration (prevents wrong-feed attacks)
    /// 3. Price age must be within the maximum allowed (prevents stale price usage)
    pub fn verify_freshness(
        ctx: Context<VerifyFreshness>,
    ) -> Result<VerificationResult> {
        let config = &ctx.accounts.config;
        let price_update = &ctx.accounts.price_update;
        let clock = Clock::get()?;

        // Check 1: Verify the account is owned by Pyth
        verify_pyth_owner(price_update)?;

        let data = price_update.try_borrow_data()?;

        // Check 2: Verify feed ID matches
        let feed_id = read_feed_id(&data)?;
        require!(
            feed_id == config.feed_id,
            VerifierError::WrongFeed
        );

        // Check 3: Verify freshness
        let publish_time = read_publish_time(&data)?;
        let age = clock.unix_timestamp - publish_time;

        let result = if age <= config.max_age_seconds as i64 {
            VerificationResult::Pass
        } else {
            VerificationResult::Fail
        };

        emit!(VerificationCompleted {
            result,
            feed_id,
            publish_time,
            age_seconds: age,
            slot: clock.slot,
        });

        Ok(result)
    }

    /// Verify freshness and record the outcome via CPI into pactyra-core.
    ///
    /// If the price is fresh (age <= max_age): records a PASS outcome.
    /// If the price is stale (age > max_age): records a FAIL outcome.
    ///   - If age > critical_threshold: severity = Critical (triggers authority downgrade)
    ///   - Otherwise: severity = Ordinary
    pub fn verify_and_record(
        ctx: Context<VerifyAndRecord>,
        action_id: [u8; 32],
        capability_id: [u8; 32],
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let price_update = &ctx.accounts.price_update;
        let clock = Clock::get()?;

        // Verify the account is owned by Pyth
        verify_pyth_owner(price_update)?;

        let data = price_update.try_borrow_data()?;

        // Verify feed ID
        let feed_id = read_feed_id(&data)?;
        require!(
            feed_id == config.feed_id,
            VerifierError::WrongFeed
        );

        // Check freshness
        let publish_time = read_publish_time(&data)?;
        let age = clock.unix_timestamp - publish_time;

        let (result, severity) = if age <= config.max_age_seconds as i64 {
            // Fresh: PASS
            (pactyra_core::OutcomeResult::Pass, pactyra_core::Severity::None)
        } else if age > config.critical_threshold_seconds as i64 {
            // Very stale: critical failure
            (pactyra_core::OutcomeResult::Fail, pactyra_core::Severity::Critical)
        } else {
            // Stale but not critical: ordinary failure
            (pactyra_core::OutcomeResult::Fail, pactyra_core::Severity::Ordinary)
        };

        emit!(VerificationCompleted {
            result: if result == pactyra_core::OutcomeResult::Pass {
                VerificationResult::Pass
            } else {
                VerificationResult::Fail
            },
            feed_id,
            publish_time,
            age_seconds: age,
            slot: clock.slot,
        });

        // Compute evidence hash from Pyth account data
        let evidence_hash = anchor_lang::solana_program::keccak::hash(&data).to_bytes();

        // CPI into pactyra_core::record_outcome
        let pactyra_core_program = ctx.accounts.pactyra_core_program.to_account_info();
        let cpi_accounts = pactyra_core::cpi::accounts::RecordOutcome {
            agent: ctx.accounts.agent.to_account_info(),
            receipt: ctx.accounts.receipt.to_account_info(),
            verifier_registry: ctx.accounts.verifier_registry.to_account_info(),
            policy: ctx.accounts.policy.to_account_info(),
            bond: Some(ctx.accounts.bond.to_account_info()),
            bond_vault: None,
            slash_destination: None,
            usdc_mint: ctx.accounts.usdc_mint.to_account_info(),
            verifier_operator: ctx.accounts.verifier_operator.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(pactyra_core_program, cpi_accounts);
        pactyra_core::cpi::record_outcome(
            cpi_ctx,
            action_id,
            capability_id,
            result,
            severity,
            evidence_hash,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(feed_id: [u8; 32])]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + FreshnessConfig::INIT_SPACE,
        seeds = [b"freshness_config", feed_id.as_ref()],
        bump
    )]
    pub config: Account<'info, FreshnessConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyFreshness<'info> {
    pub config: Account<'info, FreshnessConfig>,

    /// Pyth PriceUpdateV2 account. Owner is checked in the instruction body
    /// via `verify_pyth_owner()` against the Pyth Pull Oracle program ID.
    /// CHECK: Owner verified in instruction logic; data layout matches Pyth's PriceUpdateV2.
    #[account()]
    pub price_update: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct VerifyAndRecord<'info> {
    pub config: Account<'info, FreshnessConfig>,

    /// Pyth PriceUpdateV2 account. Owner is checked in the instruction body
    /// via `verify_pyth_owner()` against the Pyth Pull Oracle program ID.
    /// CHECK: Owner verified in instruction logic; data layout matches Pyth's PriceUpdateV2.
    #[account()]
    pub price_update: UncheckedAccount<'info>,

    /// CHECK: Constrained by `address = pactyra_core::ID` via anchor attribute.
    #[account(address = pactyra_core::ID)]
    pub pactyra_core_program: UncheckedAccount<'info>,

    // CPI accounts for pactyra_core::record_outcome
    #[account(mut)]
    pub agent: Account<'info, pactyra_core::Agent>,

    /// CHECK: Receipt PDA initialized by pactyra_core::record_outcome via CPI.
    /// Seeds: [b"receipt", agent.agent_id, action_id]
    #[account(mut)]
    pub receipt: UncheckedAccount<'info>,

    pub verifier_registry: Account<'info, pactyra_core::VerifierRegistry>,

    pub policy: Account<'info, pactyra_core::Policy>,

    /// CHECK: Bond PDA; mutability required for bond slash in record_outcome.
    /// Seeds: [b"bond", agent.agent_id]
    #[account(mut)]
    pub bond: UncheckedAccount<'info>,

    /// USDC mint — needed for record_outcome CPI (bond_vault/slash_destination are None)
    pub usdc_mint: Account<'info, anchor_spl::token::Mint>,

    #[account(mut)]
    pub verifier_operator: Signer<'info>,

    pub token_program: Program<'info, anchor_spl::token::Token>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct ConfigInitialized {
    pub feed_id: [u8; 32],
    pub max_age_seconds: u64,
    pub critical_threshold_seconds: u64,
    pub authority: Pubkey,
}

#[event]
pub struct VerificationCompleted {
    pub result: VerificationResult,
    pub feed_id: [u8; 32],
    pub publish_time: i64,
    pub age_seconds: i64,
    pub slot: u64,
}
