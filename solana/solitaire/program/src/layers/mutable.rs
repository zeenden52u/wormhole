//! This layer is used to require a Solana account to be mutable. Note that if this constraint is
//! not used, Solitaire will require an account to be immutable by default.
//!
//! Example:
//!
//! ```
//! accounts!(Transfer {
//!     payer: Mut<Signer<Info<'info>>>,
//!     payee: Mut<Info<'info>>,
//! }
//!
//! fn example(prog: &Pubkey, accs: Example, data: u64) -> Result<()> {
//!     accs.payer.lamports += data;
//!     accs.payee.lamports -= data;
//!     Ok(())
//! }
//! ```

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
pub struct Mut<T>(T);

// -----------------------------------------------------------------------------
// Program Context

// TypeIter with a standard instruction context.
impl<'info, T> TypeIter<Program<'info>> for Mut<T>
where
    T: TypeIter<Program<'info>>,
{
    type Target = T::Target;
    fn iter(mut ctx: Program<'info>) -> Result<Self::Target> {
        require!(ctx.info.is_writable, InvalidMutability(*ctx.info.key, true));
        ctx.mutable = true;
        T::iter(ctx)
    }
}

// -----------------------------------------------------------------------------
// WASM Context

// TypeIter with a WASM context. Mut is ignored on the client-side.
#[cfg(feature = "client")]
impl<'info, T> TypeIter<WASM> for Mut<T>
where
    T: TypeIter<WASM>,
{
    type Target = T::Target;
}

// -----------------------------------------------------------------------------
// Client Context

// TypeIter with a WASM context. Mut is ignored on the client-side.
#[cfg(feature = "client")]
impl<'info, T> TypeIter<Client> for Mut<T>
where
    T: TypeIter<Client>,
{
    type Target = T::Target;
    fn iter(mut ctx: Client) -> Result<Self::Target> {
        ctx.mutable = true;
        T::iter(ctx)
    }
}
