use crate::context::{
    Client,
    Program,
    WASM,
};
use crate::error::Result;
use crate::iterator::TypeIter;
use crate::require;
use solana_program::account_info::AccountInfo;
use solana_program::instruction::AccountMeta;
use solana_program::pubkey::Pubkey;

#[repr(transparent)]
pub struct Info;

// -----------------------------------------------------------------------------
// Program Context

/// When hitting the Info layer, we return an AccountInfo instead of recursing further.
impl<'info> TypeIter<Program<'info>> for Info {
    type Target = AccountInfo<'info>;
    fn iter(ctx: Program<'info>) -> Result<Self::Target> {
        Ok(ctx.info)
    }
}

/// However we need to implement TypeIter on AccountInfo still for the type level recursion base
/// case to work.
impl<'info> TypeIter<Program<'info>> for AccountInfo<'info> {
    type Target = Self;
}

// -----------------------------------------------------------------------------
// WASM Context

impl TypeIter<WASM> for Info {
    type Target = Pubkey;
}

// -----------------------------------------------------------------------------
// Client Context

impl TypeIter<Client> for Info {
    type Target = AccountMeta;
    fn iter(ctx: Client) -> Result<Self::Target> {
        Ok(AccountMeta {
            pubkey:      ctx.key,
            is_signer:   ctx.signer,
            is_writable: ctx.mutable,
        })
    }
}
