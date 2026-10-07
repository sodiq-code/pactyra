#![allow(unexpected_cfgs)]
#![allow(deprecated)]
use anchor_lang::prelude::*;

declare_id!("FgfW1JkSknJpcCypbhuv531qvVu2z8sNVPH2kZXLpDKc");

/// Maximum number of multisig members.
const MAX_MEMBERS: usize = 5;

/// A multisig wallet with threshold signing.
#[account]
#[derive(InitSpace)]
pub struct Multisig {
    /// The creator of this multisig (used for PDA derivation).
    pub creator: Pubkey,
    /// The members who can propose and approve transactions.
    #[max_len(MAX_MEMBERS)]
    pub members: Vec<Pubkey>,
    /// Number of approvals required to execute a proposal.
    pub threshold: u8,
    /// The authority that can add/remove members.
    pub config_authority: Pubkey,
    /// bump seed.
    pub bump: u8,
}

/// A proposed transaction awaiting approval.
#[account]
#[derive(InitSpace)]
pub struct Proposal {
    /// The multisig this proposal belongs to.
    pub multisig: Pubkey,
    /// The proposer.
    pub proposer: Pubkey,
    /// The instruction data to execute.
    #[max_len(1024)]
    pub instruction_data: Vec<u8>,
    /// The program to call.
    pub target_program: Pubkey,
    /// The accounts to pass to the instruction.
    #[max_len(16)]
    pub accounts: Vec<ProposalAccount>,
    /// Members who have approved.
    #[max_len(MAX_MEMBERS)]
    pub approvers: Vec<Pubkey>,
    /// Whether the proposal has been executed.
    pub executed: bool,
    /// Whether the proposal was cancelled.
    pub cancelled: bool,
    /// bump seed.
    pub bump: u8,
}

/// A single account in a proposal.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct ProposalAccount {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}

#[error_code]
pub enum MultisigError {
    #[msg("Not enough approvals to execute")]
    NotEnoughApprovals,
    #[msg("Member has already approved")]
    AlreadyApproved,
    #[msg("Signer is not a multisig member")]
    NotAMember,
    #[msg("Proposal already executed")]
    AlreadyExecuted,
    #[msg("Proposal already cancelled")]
    AlreadyCancelled,
    #[msg("Too many members")]
    TooManyMembers,
    #[msg("Only config authority can perform this action")]
    NotConfigAuthority,
}

#[program]
pub mod threshold_multisig {
    use super::*;

    /// Initialize a new multisig with the given members and threshold.
    pub fn create_multisig(
        ctx: Context<CreateMultisig>,
        members: Vec<Pubkey>,
        threshold: u8,
    ) -> Result<()> {
        require!(members.len() <= MAX_MEMBERS, MultisigError::TooManyMembers);
        let member_count = members.len() as u8;
        require!(
            threshold > 0 && threshold <= member_count,
            MultisigError::NotEnoughApprovals
        );

        let multisig = &mut ctx.accounts.multisig;
        multisig.creator = ctx.accounts.creator.key();
        multisig.members = members;
        multisig.threshold = threshold;
        multisig.config_authority = ctx.accounts.creator.key();
        multisig.bump = ctx.bumps.multisig;

        emit!(MultisigCreated {
            multisig: multisig.key(),
            threshold,
            member_count,
        });
        Ok(())
    }

    /// Propose a transaction for the multisig to execute.
    pub fn propose(
        ctx: Context<Propose>,
        target_program: Pubkey,
        instruction_data: Vec<u8>,
        accounts: Vec<ProposalAccount>,
    ) -> Result<()> {
        let multisig = &ctx.accounts.multisig;
        let proposer = ctx.accounts.proposer.key();

        // Verify proposer is a member
        require!(
            multisig.members.contains(&proposer),
            MultisigError::NotAMember
        );

        let proposal = &mut ctx.accounts.proposal;
        proposal.multisig = multisig.key();
        proposal.proposer = proposer;
        proposal.instruction_data = instruction_data;
        proposal.target_program = target_program;
        proposal.accounts = accounts;
        proposal.approvers = vec![proposer]; // proposer auto-approves
        proposal.executed = false;
        proposal.cancelled = false;
        proposal.bump = ctx.bumps.proposal;

        emit!(ProposalCreated {
            proposal: proposal.key(),
            proposer,
            target_program,
        });
        Ok(())
    }

    /// Approve a proposal. Must be a multisig member.
    pub fn approve(ctx: Context<Approve>) -> Result<()> {
        let multisig = &ctx.accounts.multisig;
        let proposal = &mut ctx.accounts.proposal;
        let approver = ctx.accounts.approver.key();

        // Verify approver is a member
        require!(
            multisig.members.contains(&approver),
            MultisigError::NotAMember
        );

        // Verify not already approved
        require!(
            !proposal.approvers.contains(&approver),
            MultisigError::AlreadyApproved
        );

        // Verify not executed/cancelled
        require!(!proposal.executed, MultisigError::AlreadyExecuted);
        require!(!proposal.cancelled, MultisigError::AlreadyCancelled);

        proposal.approvers.push(approver);

        emit!(ProposalApproved {
            proposal: proposal.key(),
            approver,
            approval_count: proposal.approvers.len() as u8,
        });
        Ok(())
    }

    /// Execute a proposal once enough approvals have been collected.
    /// This uses invoke_signed with the multisig PDA as signer.
    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let multisig = &ctx.accounts.multisig;
        let proposal = &ctx.accounts.proposal;

        require!(!proposal.executed, MultisigError::AlreadyExecuted);
        require!(!proposal.cancelled, MultisigError::AlreadyCancelled);
        require!(
            proposal.approvers.len() >= multisig.threshold as usize,
            MultisigError::NotEnoughApprovals
        );

        // Clone data we need before mutable borrow
        let target_program = proposal.target_program;
        let instruction_data = proposal.instruction_data.clone();
        let account_metas: Vec<AccountMeta> = proposal
            .accounts
            .iter()
            .map(|acc| AccountMeta {
                pubkey: acc.pubkey,
                is_signer: acc.is_signer,
                is_writable: acc.is_writable,
            })
            .collect();
        let proposal_key = proposal.key();

        // Mark as executed before CPI (reentrancy protection)
        let proposal_mut = &mut ctx.accounts.proposal;
        proposal_mut.executed = true;

        // Build the instruction for invoke_signed
        let ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: target_program,
            accounts: account_metas.clone(),
            data: instruction_data,
        };

        // Derive the multisig PDA signer
        let creator = multisig.creator;
        let bump = multisig.bump;
        let signer_seeds = &[b"multisig".as_ref(), creator.as_ref(), &[bump]];
        let signers = &[&signer_seeds[..]];

        // Collect account infos from remaining_accounts
        let account_infos: Vec<AccountInfo<'_>> = ctx
            .remaining_accounts
            .iter()
            .map(|a| a.to_account_info())
            .collect();

        anchor_lang::solana_program::program::invoke_signed(&ix, &account_infos, signers)?;

        emit!(ProposalExecuted {
            proposal: proposal_key,
            target_program,
        });
        Ok(())
    }

    /// Cancel a proposal.
    pub fn cancel_proposal(ctx: Context<CancelProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        require!(!proposal.executed, MultisigError::AlreadyExecuted);
        proposal.cancelled = true;

        emit!(ProposalCancelled {
            proposal: proposal.key(),
        });
        Ok(())
    }

    /// Add a new member to the multisig.
    pub fn add_member(ctx: Context<ManageMembers>, new_member: Pubkey) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        require!(
            multisig.members.len() < MAX_MEMBERS,
            MultisigError::TooManyMembers
        );
        require!(
            ctx.accounts.authority.key() == multisig.config_authority,
            MultisigError::NotConfigAuthority
        );
        multisig.members.push(new_member);

        emit!(MemberAdded {
            multisig: multisig.key(),
            new_member,
            member_count: multisig.members.len() as u8,
        });
        Ok(())
    }

    /// Remove a member from the multisig.
    pub fn remove_member(ctx: Context<ManageMembers>, member: Pubkey) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        require!(
            ctx.accounts.authority.key() == multisig.config_authority,
            MultisigError::NotConfigAuthority
        );
        multisig.members.retain(|m| *m != member);

        emit!(MemberRemoved {
            multisig: multisig.key(),
            removed_member: member,
            member_count: multisig.members.len() as u8,
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateMultisig<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Multisig::INIT_SPACE,
        seeds = [b"multisig", creator.key().as_ref()],
        bump
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Propose<'info> {
    #[account(
        seeds = [b"multisig", multisig.creator.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        init,
        payer = proposer,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [b"proposal", multisig.key().as_ref(), proposer.key().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(mut)]
    pub proposer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Approve<'info> {
    pub multisig: Account<'info, Multisig>,

    #[account(mut, has_one = multisig)]
    pub proposal: Account<'info, Proposal>,

    #[account(mut)]
    pub approver: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    pub multisig: Account<'info, Multisig>,

    #[account(mut, has_one = multisig)]
    pub proposal: Account<'info, Proposal>,
}

#[derive(Accounts)]
pub struct CancelProposal<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
}

#[derive(Accounts)]
pub struct ManageMembers<'info> {
    #[account(mut)]
    pub multisig: Account<'info, Multisig>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[event]
pub struct MultisigCreated {
    pub multisig: Pubkey,
    pub threshold: u8,
    pub member_count: u8,
}

#[event]
pub struct ProposalCreated {
    pub proposal: Pubkey,
    pub proposer: Pubkey,
    pub target_program: Pubkey,
}

#[event]
pub struct ProposalApproved {
    pub proposal: Pubkey,
    pub approver: Pubkey,
    pub approval_count: u8,
}

#[event]
pub struct ProposalExecuted {
    pub proposal: Pubkey,
    pub target_program: Pubkey,
}

#[event]
pub struct ProposalCancelled {
    pub proposal: Pubkey,
}

#[event]
pub struct MemberAdded {
    pub multisig: Pubkey,
    pub new_member: Pubkey,
    pub member_count: u8,
}

#[event]
pub struct MemberRemoved {
    pub multisig: Pubkey,
    pub removed_member: Pubkey,
    pub member_count: u8,
}
