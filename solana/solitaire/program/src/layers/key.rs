use crate::context::{
    Client,
    Program,
    WASM,
};
use crate::error::Result;
use crate::error::SolitaireError::*;
use crate::iterator::TypeIter;
use crate::require;

#[repr(transparent)]
pub struct Key<T, const K: &'static str>(T);

// -----------------------------------------------------------------------------
// Program Context

// TypeIter with a standard instruction context.
impl<'info, T, const K: &'static str> TypeIter<Program<'info>> for Key<T, K>
where
    T: TypeIter<Program<'info>>,
{
    type Target = T::Target;
    fn iter(ctx: Program<'info>) -> Result<Self::Target> {
        require!(ctx.info.key.to_string() == K, InvalidKey(*ctx.info.key));
        T::iter(ctx)
    }
}

// -----------------------------------------------------------------------------
// WASM Context

// TypeIter with a WASM context. Key is ignored on the client-side.
#[cfg(feature = "client")]
impl<'info, T, const K: &'static str> TypeIter<WASM> for Key<T, K>
where
    T: TypeIter<WASM>,
{
    type Target = T::Target;
}

// -----------------------------------------------------------------------------
// Client Context

// TypeIter with a WASM context. Key is ignored on the client-side.
#[cfg(feature = "client")]
impl<'info, T, const K: &'static str> TypeIter<Client> for Key<T, K>
where
    T: TypeIter<Client>,
{
    type Target = T::Target;
}
