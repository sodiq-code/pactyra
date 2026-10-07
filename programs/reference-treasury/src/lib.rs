#![allow(deprecated)]
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("6gAZR4omxMUWy5Fb6kCtdmaWASFFXr9WRCoWUcAz7UA9");

/// Treasury instance state.
#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub vault: Pubkey,
    pub fee_bps: u16,
    pub paused: bool,
    pub bump: u8,
}

/// User balance tracking for deposits.
#[account]
#[derive(InitSpace)]
pub struct UserBalance {
    pub user: Pubkey,
    pub treasury: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

/// Treasury error codes.
#[error_code]
pub enum TreasuryError {
    #[msg("The treasury is paused")]
    TreasuryPaused,
    #[msg("Insufficient vault balance for transfer")]
    InsufficientBalance,
    #[msg("Unauthorized to perform this action")]
    Unauthorized,
    #[msg("Invalid token mint")]
    InvalidMint,
    #[msg("Transfer amount must be greater than zero")]
    ZeroTransfer,
    #[msg("The capability assertion failed")]
    CapabilityAssertionFailed,
}

#[program]
pub mod reference_treasury {
    use super::*;

    /// Initialize a treasury instance.
    /// Creates a vault token account (PDA) for holding USDC.
    pub fn initialize_treasury(ctx: Context<InitializeTreasury>, fee_bps: u16) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        treasury.authority = ctx.accounts.authority.key();
        treasury.usdc_mint = ctx.accounts.usdc_mint.key();
        treasury.vault = ctx.accounts.vault.key();
        treasury.fee_bps = fee_bps;
        treasury.paused = false;
        treasury.bump = ctx.bumps.treasury;
        emit!(TreasuryInitialized {
            treasury: treasury.key(),
            authority: ctx.accounts.authority.key(),
            usdc_mint: ctx.accounts.usdc_mint.key(),
            vault: ctx.accounts.vault.key(),
        });
        Ok(())
    }

    /// Deposit USDC into the treasury vault.
    /// Anyone can deposit; the depositor's balance is tracked.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, TreasuryError::ZeroTransfer);
        let treasury = &ctx.accounts.treasury;
        require!(!treasury.paused, TreasuryError::TreasuryPaused);

        // Transfer USDC from user to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

        // Update user balance
        let balance = &mut ctx.accounts.user_balance;
        balance.user = ctx.accounts.user.key();
        balance.treasury = treasury.key();
        balance.amount += amount;

        emit!(Deposited {
            user: ctx.accounts.user.key(),
            amount,
            new_balance: balance.amount,
        });
        Ok(())
    }

    /// Authorized transfer from the treasury vault.
    ///
    /// This instruction CPIs into pactyra_core::assert_capability BEFORE
    /// executing the USDC transfer. If the capability assertion fails
    /// (insufficient authority, wrong target, expired, stale epoch, etc.),
    /// the entire transaction reverts and no USDC is moved.
    ///
    /// After the USDC transfer succeeds, it CPIs into
    /// pactyra_core::mark_executed to advance the Execution PDA from
    /// Asserted -> Executed. This is the cryptographic binding that
    /// proves the action's on-chain effects were applied — without it,
    /// record_outcome will refuse to record an outcome for this action.
    ///
    /// This is the architectural security boundary: the treasury cannot
    /// move funds without a valid PACTYRA capability, and outcomes cannot
    /// be recorded for actions the treasury never performed.
    pub fn authorized_transfer(
        ctx: Context<AuthorizedTransfer>,
        amount: u64,
        action_nonce: u64,
    ) -> Result<()> {
        require!(amount > 0, TreasuryError::ZeroTransfer);
        let treasury = &ctx.accounts.treasury;
        require!(!treasury.paused, TreasuryError::TreasuryPaused);

        let vault = &ctx.accounts.vault;
        require!(vault.amount >= amount, TreasuryError::InsufficientBalance);

        // Build the action parameters for assert_capability
        let action = pactyra_core::ActionParams {
            action_type: pactyra_core::CapabilityType::PayService,
            target_program: ctx.accounts.treasury.key(),
            target_account: ctx.accounts.recipient_token.key(),
            amount,
            action_nonce,
        };

        // CPI into pactyra_core::assert_capability
        // This verifies all 12 security checks before authorizing the transfer.
        // If any check fails, the transaction reverts here — no USDC is moved.
        // assert_capability also initializes the Execution PDA (status=Asserted).
        let pactyra_core_program = ctx.accounts.pactyra_core_program.to_account_info();
        let cpi_accounts = pactyra_core::cpi::accounts::AssertCapability {
            agent: ctx.accounts.agent.to_account_info(),
            capability: ctx.accounts.capability.to_account_info(),
            policy: ctx.accounts.policy.to_account_info(),
            consumed_nonce: ctx.accounts.consumed_nonce.to_account_info(),
            execution: ctx.accounts.execution.to_account_info(),
            delegate_scope: None,
            authority_root: ctx.accounts.authority_root.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(pactyra_core_program.clone(), cpi_accounts);
        pactyra_core::cpi::assert_capability(cpi_ctx, action.clone())?;

        // Capability assertion passed — execute the USDC transfer
        let signer_seeds = &[
            b"treasury".as_ref(),
            treasury.authority.as_ref(),
            &[treasury.bump],
        ];
        let signer = &[&signer_seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.recipient_token.to_account_info(),
            authority: ctx.accounts.treasury.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, signer),
            amount,
        )?;

        // Mark the Execution as Executed. The treasury PDA signs via CPI
        // seeds — its address matches execution.target_program, satisfying
        // the MarkExecuted account constraints. This proves to record_outcome
        // that the action's on-chain effects were actually applied.
        let cpi_accounts = pactyra_core::cpi::accounts::MarkExecuted {
            execution: ctx.accounts.execution.to_account_info(),
            executor: ctx.accounts.treasury.to_account_info(),
        };
        let cpi_ctx =
            CpiContext::new_with_signer(pactyra_core_program.clone(), cpi_accounts, signer);
        pactyra_core::cpi::mark_executed(cpi_ctx)?;

        emit!(AuthorizedTransferExecuted {
            treasury: treasury.key(),
            recipient: ctx.accounts.recipient_token.key(),
            amount,
            action_nonce,
        });
        Ok(())
    }

    /// Pause the treasury (emergency only).
    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        require!(
            treasury.authority == ctx.accounts.authority.key(),
            TreasuryError::Unauthorized
        );
        treasury.paused = paused;
        emit!(PauseStateChanged {
            treasury: treasury.key(),
            paused,
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Treasury::INIT_SPACE,
        seeds = [b"treasury", authority.key().as_ref()],
        bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = treasury,
        seeds = [b"vault", treasury.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub treasury: Account<'info, Treasury>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserBalance::INIT_SPACE,
        seeds = [b"user_balance", treasury.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_balance: Account<'info, UserBalance>,

    #[account(mut, constraint = user_token.mint == treasury.usdc_mint)]
    pub user_token: Account<'info, TokenAccount>,

    #[account(mut, constraint = vault.mint == treasury.usdc_mint)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, action_nonce: u64)]
pub struct AuthorizedTransfer<'info> {
    #[account(
        mut,
        seeds = [b"treasury", treasury.authority.as_ref()],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, Treasury>,

    // --- PACTYRA CPI accounts ---
    /// The agent whose capability is being asserted.
    #[account(mut)]
    pub agent: Account<'info, pactyra_core::Agent>,

    /// The capability being asserted.
    #[account(
        mut,
        constraint = capability.agent_id == agent.agent_id,
    )]
    pub capability: Account<'info, pactyra_core::Capability>,

    /// The policy that governs this capability.
    #[account(
        constraint = policy.key() == capability.policy_key
    )]
    pub policy: Account<'info, pactyra_core::Policy>,

    /// CHECK: ConsumedNonce PDA, initialized by the CPI into assert_capability.
    /// Seeds: [b"nonce", agent.agent_id, action_nonce]
    #[account(mut)]
    pub consumed_nonce: UncheckedAccount<'info>,

    /// Execution PDA, initialized by the CPI into assert_capability and
    /// advanced to Executed by the CPI into mark_executed.
    /// Seeds: [b"execution", agent.agent_id, action_nonce]
    /// CHECK: Owned by pactyra-core; verified in CPI.
    #[account(mut)]
    pub execution: UncheckedAccount<'info>,

    /// CHECK: Constrained by `address = pactyra_core::ID`.
    #[account(address = pactyra_core::ID)]
    pub pactyra_core_program: UncheckedAccount<'info>,

    // --- Token accounts ---
    #[account(mut, constraint = vault.mint == treasury.usdc_mint)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut, constraint = recipient_token.mint == treasury.usdc_mint)]
    pub recipient_token: Account<'info, TokenAccount>,

    // --- Signers ---
    /// The agent's authority root — must sign to prove the agent authorized this action.
    #[account(mut)]
    pub authority_root: Signer<'info>,

    // --- Programs ---
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    #[account(mut)]
    pub treasury: Account<'info, Treasury>,

    #[account(signer)]
    pub authority: Signer<'info>,
}

#[event]
pub struct TreasuryInitialized {
    pub treasury: Pubkey,
    pub authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub vault: Pubkey,
}

#[event]
pub struct Deposited {
    pub user: Pubkey,
    pub amount: u64,
    pub new_balance: u64,
}

#[event]
pub struct AuthorizedTransferExecuted {
    pub treasury: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub action_nonce: u64,
}

#[event]
pub struct PauseStateChanged {
    pub treasury: Pubkey,
    pub paused: bool,
}
