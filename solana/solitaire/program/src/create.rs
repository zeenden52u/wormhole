//! Account creation facilities. This provides a way to allocate, re-allocate, and destroy Solana
//! accounts safely.

use crate::error::Result;
use crate::layers::ToSeeds;
use solana_program::account_info::AccountInfo;
use solana_program::program::{
    invoke,
    invoke_signed,
};
use solana_program::pubkey::Pubkey;
use solana_program::rent;
use solana_program::system_instruction::{
    allocate,
    assign,
    transfer,
};

/// Solana accounts require Lamports to be greater than zero in order to not be garbage collected
/// by the blockchain. At a certain amount the account is exempt from being removed, and anything
/// below this value is charged rent over time until the account eventually hits 0.
pub enum Rent {
    Exempt,
    Amount(u64),
}

impl Rent {
    pub fn minimum(self, account_size: usize) -> u64 {
        match self {
            Rent::Exempt => rent::Rent::default().minimum_balance(account_size),
            Rent::Amount(v) => v,
        }
    }
}

pub struct CreateArgs<'a, Seeds> {
    pub owner: &'a Pubkey,
    pub payer: &'a Pubkey,
    pub rent:  Rent,
    pub seeds: Option<Seeds>,
    pub size:  usize,
}

/// Create an account.
///
/// This proceeds in the following order:
///
/// 1. Top up the account with the required amount of funds to cover the rent period.
/// 2. Allocate necessary size.
/// 3. Assign ownership.
///
/// These steps are equivelent to calling [`system_instruction::create_account`], but because it
/// refuses to create an account that already has lamports, we instead do it manually. This is a
/// better behaviour than the built-in because otherwise a malicious user can transfer funds to a
/// PDA before the program and DoS the system.
pub fn create_account<Seeds>(
    info: &AccountInfo,
    accs: &[AccountInfo],
    args: CreateArgs<Seeds>,
) -> Result<()>
where
    Seeds: ToSeeds,
{
    // Get the AccountInfo list and Seeds required to create the account.
    let seeds = args
        .seeds
        .as_ref()
        .map_or_else(Vec::new, |seeds| seeds.to_seeds());

    // The minimum amount of rent required by the caller.
    let rent_cost = args.rent.minimum(args.size);

    // If we are below the minimum, transfer enough lamports to cover it.
    if info.lamports() < rent_cost {
        let transfer_ix = transfer(args.payer, info.key, rent_cost - info.lamports());
        invoke(&transfer_ix, accs)?
    }

    // Allocate space, normally create_account would do this but it is a required step when
    // manually creating an account.
    let allocate_ix = allocate(info.key, args.size as u64);
    invoke_signed(&allocate_ix, accs, &[&*seeds])?;

    // Assign ownership, this must be done in the same instruction as creation as it cannot be
    // changed in the future.
    let assign_ix = assign(info.key, args.owner);
    invoke_signed(&assign_ix, accs, &[&*seeds])?;

    Ok(())
}
