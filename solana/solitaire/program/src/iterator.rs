//! A Type-level Iterator implementation for type inspection.
//!
//! Solitaire is based on the ability to describe Solana accounts as nested generics. The iterator
//! provided by this module can be used to inspect these types to automatically enforce constraints
//! or provide automatic codegen.
//!
//! # An Example Account
//!
//! An example Solana account common in programs is a payer, which is a key that has signed and is
//! mutable so that lamports can be deducted from it:
//!
//! ```rust
//!   let payer: AccountInfo = Mut<Signer<Info>>::iter(acc);
//! ```
//!
//! The type iterator above will generate calls to the relevant checks required to verify the type,
//! by executing a callback at each layer of the generic. The above is nearly equivalent to hand
//! writing the following:
//!
//! ```rust
//!   let account = {
//!       let account = next_account_info(accs)?;
//!       is_mutable(&account)?;
//!       is_signer(&account)?;
//!       account
//!   };
//! ```
//!
//! Each outer layer of a type is referred to as a layer (e.g Mut, Signer, etc), and the inner-most
//! type is referred to as the leaf (e.g Data, Info, etc). Layers add additional checks to apply to
//! the leaf, and the result of the iteration is the leaf type. In other words, the above is an
//! Info with two constraints.
//!
//! See [`layers`] for more layer and leaf implementations.
//!
//! # Contexts
//!
//! In the above example, an `AccountInfo` is passed to the iterator, which is used as the context
//! that each layer will check against.
//!
//! Other context types can be passed however to get different behaviours. For example the `Client`
//! context can be used instead which does not perform validation, but instead produces a
//! dictionary of properties the account. This is useful for generating client-side calls for
//! programs automatically, for example to generate `invoke_signed` with the right set of signers.
//!
//! ```rust
//!   let props = Mut<Signer<Info>>::iter(Client::from_account(acc));
//!   assert!(props.mutable == true);
//!   assert!(props.signer == true);
//!   assert!(props.key == acc.key);
//! ```
//!
//! # Implementation Details
//!
//! The iterator works using two traits, [`TypeIter`] and [`TypeCallback`]. The `TypeIter` trait
//! must be implemented on each layer, including the leaf. When invoking the `iter` method, the
//! iterator will then repeatedly call `iter` on the next nested type until the type has been
//! consumed. Code in the iter() method can inspect the context and enforce constraints.
//!
//! Visually, the iterator behaves like so:
//!
//! ```rust
//! // let acc = Mut<Signer<Data<u64, {New}>>>::iter(ctx);
//! //           |   |      |
//! //        1) +---|------|-> Mut::iter(acc,  is_mutable(acc))
//! //        2)     +------|-> Signer::iter(acc, is_signer(acc))
//! //        3)            +-> Data<u64, {New}>::iter(acc, is_new(acc))
//!
//! The implementation of the final leaf is returned to the caller, so in this case we would get
//! back a Data leaf.
//! ```

use crate::error::{
    Result,
    SolitaireError,
};
use solana_program::account_info::AccountInfo;
use solana_program::instruction::{
    AccountMeta,
    Instruction,
};
use solana_program::pubkey::Pubkey;

/// TypeIter is implemented by pointing an associated `Target` type at the next level in the
/// generic stack. The `iter` method invokes iter on the next level in the stack repeatedly until
/// the leaf is reached. The return type is the `Target` type of the final layer/leaf.
///
/// ```rust
/// assert!(Mut<Signer<Info>>::Target == AccountInfo);
/// let acc: AccountInfo = Mut<Signer<Info>>::iter(next_account_info(accs)?);
/// ```
pub trait TypeIter<Context> {
    /// Target is the return type for the iteration layer. It can be pointed at the next layer
    /// repeatedly to get the leaf type.
    type Target;

    /// This method takes a context and invokes a callback for the current stage, then invokes the
    /// next layers iter() method recursively.
    fn iter(ctx: Context) -> Result<Self::Target> {
        Err(SolitaireError::InvalidIterator)
    }
}
