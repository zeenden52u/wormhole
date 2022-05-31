//! This file implements a macro that generates functionality for managing accounts. This includes:
//!
//! - Deserializing/Parsing from a list of AccountInfo structures.
//! - Persisting data structures into accounts.
//! - Verifying security guarantees such as account ownership, mutability, etc.

use crate::Peel;
use crate::Result;

/// This macro generates a structure for a list of accounts, and also generates code for all the
/// above listed functionality. For each sub-functionality, a seperate sub-macro is called to
/// implement the relevant logic.
#[macro_export]
macro_rules! accounts {
    // Generic-Less.
    ($name:ident {
        $($field:ident: $kind:ty),* $(,)?
    }) => {
        // Generate structure containing named account fields
        pub struct $name<'info> {
            $(pub $field: $kind,)*
        }

        // Generate Solitaire functions on top of the defined structure. 
        impl<'info> $name<'info> {
            accounts_impl!(
                $($field: $kind),*
            );
        }
    };

    // Generic-Full.
    ($name:ident<$($tt:tt),*> {
        $($field:ident: $kind:ty),* $(,)?
    }) => {
        // Generate structure containing named account fields
        struct $name<'info, $($tt,)*> {
            $($field: $kind,)*
        }

        // Generate Solitaire functions on top of the defined structure. 
        impl<'info, $($tt,)*> $name<'info, $($tt,)*> {
            accounts_impl!(
                $($field: $kind),*
            );
        }
    };
}

#[macro_export]
macro_rules! accounts_impl {
    ( $($field:ident: $kind:ty),* $(,)?) => {
        // Build the structure from a list of solana AccountInfo.
        pub fn parse<T>(
            prog: &solana_program::pubkey::Pubkey,
            accs: &[solana_program::account_info::AccountInfo<'info>],
            data: &T
        ) -> Result<Self> {
            let mut iter = accs.iter();
            Ok(Self {
                $(
                    $field: <$kind>::peel($crate::Context::new(
                        prog,
                        solana_program::account_info::next_account_info(&mut iter)?,
                        data
                    ))?,
                )*
            })
        }

        // Persist the structure by writing each field into its related account.
        pub fn persist(&self, prog: &solana_program::pubkey::Pubkey) -> Result<()> {
            $( <$kind>::persist(&self.$field, prog)?; )*
            Ok(())
        }
    }
}
