use crate::accounts::{
    AccountOwner,
    HasOwner,
};
use crate::context::{
    Client,
    Program,
    WASM,
};
use crate::error::Result;
use crate::error::SolitaireError::*;
use crate::iterator::TypeIter;
use crate::prelude::AccountState;
use crate::require;
use solana_program::account_info::AccountInfo;
use solana_program::instruction::AccountMeta;
use solana_program::program_pack::{
    IsInitialized,
    Pack as SolanaPack,
};
use solana_program::pubkey::Pubkey;
use std::marker::PhantomData;
use std::ops::{
    Deref,
    DerefMut,
};

#[repr(transparent)]
pub struct Pack<T, const STATE: AccountState>(PhantomData<T>);
pub struct PackWrapper<'info, T, const STATE: AccountState> {
    pub(crate) _info: AccountInfo<'info>,
    pub(crate) _data: T,
}

// -----------------------------------------------------------------------------
// Program Context

impl<'info, T, const STATE: AccountState> TypeIter<Program<'info>> for Pack<T, STATE>
where
    T: SolanaPack,
    T: Default,
    T: HasOwner,
    T: IsInitialized,
{
    type Target = PackWrapper<'info, T, STATE>;
    fn iter(ctx: Program<'info>) -> Result<Self::Target> {
        Self::Target::iter(ctx)
    }
}

impl<'info, T, const STATE: AccountState> TypeIter<Program<'info>> for PackWrapper<'info, T, STATE>
where
    T: SolanaPack,
    T: Default,
    T: HasOwner,
    T: IsInitialized,
{
    type Target = Self;
    fn iter(ctx: Program<'info>) -> Result<Self::Target> {
        // Borrow the data and infer initialization state.
        let bytes = ctx.info.data.borrow();
        let empty = bytes.is_empty();

        // Attempt to deserialize or construct a default data.
        let data = match STATE {
            // Account must already be initialized, fail if the account is empty.
            AccountState::Init => {
                require!(empty, Uninitialized(*ctx.info.key));
                T::unpack(&mut &**bytes)?
            }

            // Account must not exist, construct a default.
            AccountState::Uninit => {
                require!(empty, AlreadyInitialized(*ctx.info.key));
                T::default()
            }

            // Account might exist, if it's not empty deserialize, otherwise default.
            AccountState::MayInit if !empty => T::unpack(&mut &**bytes)?,
            AccountState::MayInit => T::default(),
        };

        // When the account is initialized, it has a defined owner. Check here that the account is
        // owned by the program we expect.
        if !empty {
            use AccountOwner::*;
            let owner = *ctx.info.owner;
            match data.owner() {
                Any => {}
                Other(v) => require!(owner != v, InvalidOwner(*ctx.info.owner)),
                This => require!(owner == ctx.program_id, InvalidOwner(*ctx.info.owner)),
            }
        }

        Ok(PackWrapper {
            _info: ctx.info.clone(),
            _data: data,
        })
    }
}

// -----------------------------------------------------------------------------
// WASM Context

#[cfg(feature = "client")]
impl<T, const STATE: AccountState> TypeIter<WASM> for Pack<T, STATE> {
    type Target = Pubkey;
}

// -----------------------------------------------------------------------------
// Client Context

#[cfg(feature = "client")]
impl<T, const STATE: AccountState> TypeIter<Client> for Pack<T, STATE> {
    type Target = AccountMeta;
    fn iter(ctx: Client) -> Result<Self::Target> {
        Ok(AccountMeta {
            pubkey:      ctx.key,
            is_signer:   ctx.signer,
            is_writable: ctx.mutable,
        })
    }
}

// -----------------------------------------------------------------------------

impl<T, const STATE: AccountState> Deref for PackWrapper<'_, T, STATE>
where
    T: Default,
    T: SolanaPack,
{
    type Target = T;
    fn deref(&self) -> &Self::Target {
        &self._data
    }
}

impl<T, const STATE: AccountState> DerefMut for PackWrapper<'_, T, STATE>
where
    T: Default,
    T: SolanaPack,
{
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self._data
    }
}

impl<'info, T, const STATE: AccountState> PackWrapper<'info, T, STATE>
where
    T: Default,
    T: SolanaPack,
{
    /// Is the account already initialized / created
    pub fn is_initialized(&self) -> bool {
        !self._info.data.borrow().is_empty()
    }

    pub fn persist(&self, program_id: &Pubkey) -> Result<()>
    where
        [(); <T as solana_program::program_pack::Pack>::LEN]:,
    {
        use std::io::Write;

        if self._info.owner != program_id {
            return Ok(());
        }
        if !self._info.is_writable {
            return Ok(());
        }

        // Serialize into Account.
        let mut data = [0u8; <T as solana_program::program_pack::Pack>::LEN];
        solana_program::program_pack::Pack::pack_into_slice(&self._data, &mut data);
        (*self._info.data.borrow_mut()).write(&data)?;
        Ok(())
    }
}
