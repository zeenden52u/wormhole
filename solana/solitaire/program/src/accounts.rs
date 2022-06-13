//! Traits and Utilities for working with Solitaire Accounts.
//!
//! This module provides a number of traits and utilities for working with Solitaire accounts.

use crate::error::Result;
use crate::layers::AccountState::{
    self,
    Init,
};
use crate::layers::BorshWrapper;
use crate::prelude::Derive;
use borsh::{
    BorshDeserialize,
    BorshSerialize,
};
use solana_program::account_info::AccountInfo;
use solana_program::pubkey::Pubkey;

/// A trait implemented by types that have an `AccountInfo` underlying them.
pub trait HasInfo<'info> {
    fn info(&self) -> &AccountInfo<'info>;
}

impl<'info> HasInfo<'info> for AccountInfo<'info> {
    fn info(&self) -> &AccountInfo<'info> {
        self
    }
}

impl<'info, T, const STATE: AccountState> HasInfo<'info> for BorshWrapper<'info, T, STATE>
where
    T: BorshSerialize + BorshDeserialize,
    T: Default,
{
    fn info(&self) -> &AccountInfo<'info> {
        &self._info
    }
}

/// A trait implemented by Account types, indicating which program owns it. By default all programs
/// are owned by the currently executing program.
pub trait HasOwner {
    fn owner(&self) -> AccountOwner {
        AccountOwner::This
    }
}

/// Implement HasOwner for a BorshWrapper that passes through to the owner of the underlying
/// BorshWrapper instead.
impl<T> HasOwner for BorshWrapper<'_, T, { Init }>
where
    T: BorshSerialize + BorshDeserialize,
    T: Default,
    T: HasOwner,
{
    fn owner(&self) -> AccountOwner {
        self._data.owner()
    }
}

#[derive(PartialEq, Eq)]
pub enum AccountOwner {
    Any,
    This,
    Other(Pubkey),
}

/// A trait indicating that an account can be persisted.
pub trait Persist {
    fn persist(&self, prog: &Pubkey) -> Result<()>;
}

impl<T, Seeds> Persist for Derive<T, Seeds>
where
    T: Persist,
    Seeds: ?Sized,
{
    fn persist(&self, prog: &Pubkey) -> Result<()> {
        self.next.persist(prog)
    }
}

impl<T, const STATE: AccountState> Persist for BorshWrapper<'_, T, STATE>
where
    T: BorshSerialize + BorshDeserialize,
{
    fn persist(&self, prog: &Pubkey) -> Result<()> {
        if self._info.owner != prog {
            return Ok(());
        }
        if self._info.is_writable {
            return Ok(());
        }
        self._data.serialize(&mut *self._info.data.borrow_mut())?;
        Ok(())
    }
}

impl<'a> Persist for AccountInfo<'a> {
    fn persist(&self, _prog: &Pubkey) -> Result<()> {
        Ok(())
    }
}
