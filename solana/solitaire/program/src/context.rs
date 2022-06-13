//! Contexts to be used with TypeIter.
//!
//! These contexts are passed to the `iter()` method in the [`TypeIter`] trait. Each one implements
//! a different behaviour when parsing an account. See the documentation in the [`iterator`]
//! submodule for more information.

use solana_program::account_info::AccountInfo;
use solana_program::pubkey::Pubkey;

/// The `Program` context applies validation to a Solana account.
pub struct Program<'info> {
    pub mutable:    bool,
    pub program_id: Pubkey,
    pub info:       AccountInfo<'info>,
}

/// The `Client` context produces metadata about an account for us in client-generation.
pub struct Client {
    pub key:     Pubkey,
    pub mutable: bool,
    pub signer:  bool,
}

/// The `WASM` context maps an account to a WASM JsonValue.
pub struct WASM;

/// The `CPI` context generates metadata to produce correct `invoke_signed` calls.
pub struct CPI;
