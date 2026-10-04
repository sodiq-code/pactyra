use anchor_lang::prelude::*;

declare_id!("5dK7xXDUSHDcP8qFxrLLFo4Nm2Xzn7rSKgDMmrFFLZsN");

/// Freshness verification result.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum VerificationResult {
    Pass,
    Fail,
}

/// Failure severity classification.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
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
    #[msg("The feed ID does not match the policy")]
    WrongFeed,
    #[msg("The price update account is not owned by Pyth")]
    WrongOwner,
    #[msg("The price is invalid")]
    InvalidPrice,
    #[msg("Unauthorized verifier operator")]
    UnauthorizedOperator,
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

    /// Verify a price update's freshness.
    /// In the full implementation, this reads Pyth's PriceUpdateV2 account.
    /// For now, this accepts a publish_time and checks against the config.
    pub fn verify_freshness(
        ctx: Context<VerifyFreshness>,
        publish_time: i64,
    ) -> Result<VerificationResult> {
        let config = &ctx.accounts.config;
        let clock = Clock::get()?;
        let age = clock.unix_timestamp - publish_time;

        if age > config.max_age_seconds as i64 {
            emit!(VerificationCompleted {
                result: VerificationResult::Fail,
                age_seconds: age,
                slot: clock.slot,
            });
            return Ok(VerificationResult::Fail);
        }

        emit!(VerificationCompleted {
            result: VerificationResult::Pass,
            age_seconds: age,
            slot: clock.slot,
        });
        Ok(VerificationResult::Pass)
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
    pub age_seconds: i64,
    pub slot: u64,
}
