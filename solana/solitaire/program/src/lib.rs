
#![feature(adt_const_params)]
#![allow(warnings)]

// We need a few Solana things in scope in order to properly abstract Solana.
use solana_program::{
    account_info::{
        next_account_info,
        AccountInfo,
    },
    entrypoint,
    entrypoint::ProgramResult,
    instruction::{
        AccountMeta,
        Instruction,
    },
    program::invoke_signed,
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    system_program,
    sysvar::{
        self,
        SysvarId,
    },
};

use std::{
    io::{
        ErrorKind,
        Write,
    },
    marker::PhantomData,
    ops::{
        Deref,
        DerefMut,
    },
    slice::Iter,
    string::FromUtf8Error,
};

pub use borsh::{
    BorshDeserialize,
    BorshSerialize,
};

// Expose all submodules from this crate.
pub mod error;
pub mod macros;
pub mod processors;
pub mod types;

// This is the set of imports that is re-exported to act as the public API for this library.
pub use crate::{
    error::{
        ErrBox,
        Result,
        SolitaireError,
    },
    macros::*,
    processors::{
        keyed::Keyed,
        peel::Peel,
        persist::Persist,
        seeded::{
            invoke_seeded,
            AccountOwner,
            AccountSize,
            Creatable,
            Owned,
            Seeded,
        },
    },
    types::*,
};

/// Library name and version to print in entrypoint. Must be evaluated in this crate in order to do
/// the right thing.
pub const PKG_NAME_VERSION: &'static str =
    concat!(env!("CARGO_PKG_NAME"), " ", env!("CARGO_PKG_VERSION"));

pub struct ExecutionContext<'a, 'b: 'a> {
    /// A reference to the program_id of the currently executing program.
    pub program_id: &'a Pubkey,

    /// This is the original list of accounts passed to the entrypoint. This can be used to access
    /// any trailing accounts that were not processed by the program. Be careful when using this
    /// directly.
    pub accounts: &'a [AccountInfo<'b>],
}

/// Lamports to pay to an account being created
pub enum CreationLamports {
    Exempt,
    Amount(u64),
}

impl CreationLamports {
    /// Amount of lamports to be paid in account creation
    pub fn amount(self, size: usize) -> u64 {
        match self {
            CreationLamports::Exempt => Rent::default().minimum_balance(size),
            CreationLamports::Amount(v) => v,
        }
    }
}
