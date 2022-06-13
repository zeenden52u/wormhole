use crate::context::{
    Client,
    Program,
    WASM,
};
use crate::error::Result;
use crate::error::SolitaireError::*;
use crate::iterator::TypeIter;
use crate::require;
use solana_program::pubkey::Pubkey;

#[repr(transparent)]
pub struct Signer<T>(T);

// -----------------------------------------------------------------------------
// Program Context

// TypeIter with a standard instruction context.
impl<'info, T> TypeIter<Program<'info>> for Signer<T>
where
    T: TypeIter<Program<'info>>,
{
    type Target = T::Target;
    fn iter(ctx: Program<'info>) -> Result<Self::Target> {
        require!(ctx.info.is_signer, InvalidSigner(*ctx.info.key));
        T::iter(ctx)
    }
}

// -----------------------------------------------------------------------------
// WASM Context

#[cfg(feature = "client")]
use solana_sdk::signature::Keypair;

// TypeIter with a WASM context. Mut is ignored on the client-side.
#[cfg(feature = "client")]
impl<'info, T> TypeIter<WASM> for Signer<T>
where
    T: TypeIter<WASM>,
{
    type Target = Pubkey;
}

// -----------------------------------------------------------------------------
// Client Context

// TypeIter with a WASM context. Mut is ignored on the client-side.
#[cfg(feature = "client")]
impl<'info, T> TypeIter<Client> for Signer<T>
where
    T: TypeIter<Client>,
{
    type Target = T::Target;
    fn iter(mut ctx: Client) -> Result<Self::Target> {
        ctx.signer = true;
        T::iter(ctx)
    }
}
