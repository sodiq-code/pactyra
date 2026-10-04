use anchor_lang::prelude::*;
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

/// User balance tracking.
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
    #[msg("Insufficient balance for transfer")]
    InsufficientBalance,
    #[msg("Unauthorized to perform this action")]
    Unauthorized,
    #[msg("Invalid token mint")]
    InvalidMint,
    #[msg("Transfer amount must be greater than zero")]
    ZeroTransfer,
}

#[program]
pub mod reference_treasury {
    use super::*;

    /// Initialize a treasury instance.
    pub fn initialize_treasury(
        ctx: Context<InitializeTreasury>,
        fee_bps: u16,
    ) -> Result<()> {
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

    /// Deposit USDC into the treasury.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, TreasuryError::ZeroTransfer);
        let treasury = &ctx.accounts.treasury;
        require!(!treasury.paused, TreasuryError::TreasuryPaused);

        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

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

    /// Authorized transfer from the treasury.
    /// In the full implementation, this CPIs into pactyra-core::assert_capability.
    pub fn authorized_transfer(
        ctx: Context<AuthorizedTransfer>,
        amount: u64,
        action_hash: [u8; 32],
    ) -> Result<()> {
        require!(amount > 0, TreasuryError::ZeroTransfer);
        let treasury = &ctx.accounts.treasury;
        require!(!treasury.paused, TreasuryError::TreasuryPaused);

        let vault = &ctx.accounts.vault;
        require!(
            vault.amount >= amount,
            TreasuryError::InsufficientBalance
        );

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

        emit!(AuthorizedTransferExecuted {
            treasury: treasury.key(),
            recipient: ctx.accounts.recipient_token.key(),
            amount,
            action_hash,
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
        mut,
        constraint = vault.mint == usdc_mint.key() && vault.owner == treasury.key()
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
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
pub struct AuthorizedTransfer<'info> {
    #[account(mut, has_one = authority)]
    pub treasury: Account<'info, Treasury>,

    #[account(signer)]
    pub authority: Signer<'info>,

    #[account(mut, constraint = vault.mint == treasury.usdc_mint)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut, constraint = recipient_token.mint == treasury.usdc_mint)]
    pub recipient_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
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
    pub action_hash: [u8; 32],
}

#[event]
pub struct PauseStateChanged {
    pub treasury: Pubkey,
    pub paused: bool,
}
