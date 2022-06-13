use crate::context::{
    Client,
    Program,
    WASM,
};
use crate::error::Result;
use crate::iterator::TypeIter;
use crate::require;
use solana_program::pubkey::Pubkey;
use std::marker::PhantomData;

/// ToSeeds can be implemented for any type that is convertable to an array of bytes for Solana's
/// PDA derivations.
pub trait ToSeeds {
    fn to_seeds(&self) -> Vec<&[u8]>;
}

impl ToSeeds for &'static str {
    fn to_seeds(&self) -> Vec<&[u8]> {
        vec![self.as_bytes()]
    }
}

/// Wrapper used to force a Solana account to have its derivation verified. Note that Seeds are
/// marked as ?Sized so that the `str` default seed type is valid.
#[must_use]
#[repr(transparent)]
pub struct Derive<T, Seeds: ?Sized = str> {
    pub(crate) next:    T,
    pub(crate) _marker: PhantomData<Seeds>,
}

// -----------------------------------------------------------------------------
// Program Context

// TypeIter with a standard instruction context.
impl<'info, T, Seeds> TypeIter<Program<'info>> for Derive<T, Seeds>
where
    T: TypeIter<Program<'info>>,
    Seeds: ?Sized,
{
    type Target = Derive<T::Target, Seeds>;
    fn iter(ctx: Program<'info>) -> Result<Self::Target> {
        Ok(Derive {
            next:    T::iter(ctx)?,
            _marker: PhantomData,
        })
    }
}

// -----------------------------------------------------------------------------
// WASM Context

#[cfg(feature = "client")]
impl<'info, T, Seeds> TypeIter<WASM> for Derive<T, Seeds>
where
    Seeds: ?Sized,
{
    type Target = Pubkey;
}

// -----------------------------------------------------------------------------
// Client Context

#[cfg(feature = "client")]
impl<T, Seeds> TypeIter<Client> for Derive<T, Seeds>
where
    T: TypeIter<Client>,
    Seeds: ?Sized,
{
    type Target = T::Target;
}

// -----------------------------------------------------------------------------

impl<T, Seeds: ?Sized> Derive<T, Seeds> {
    pub fn derive(&mut self, _seeds: &Seeds) -> Result<&mut T> {
        Ok(&mut self.next)
    }
}
