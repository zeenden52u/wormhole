//! This file implements a macro that generates functionality for managing accounts. This includes:
//!
//! - Deserializing/Parsing from a list of AccountInfo structures.
//! - Persisting data structures into accounts.
//! - Verifying security guarantees such as account ownership, mutability, etc.

/// This macro generates a structure for a list of accounts, and also generates code for all the
/// above listed functionality. For each sub-functionality, a seperate sub-macro is called to
/// implement the relevant logic.
#[macro_export]
macro_rules! instruction {
    // Generic-Less.
    ($callback:ident, $data:ident, $name:ident {
        $($field:ident: $kind:ty),* $(,)?
    }) => {
        use $crate::context::{
            Program,
            Client,
            WASM,
        };
        use $crate::iterator::TypeIter;

        // Re-emit the structure provided by the user, with 'info injected.
        pub struct $name<'a, 'info> {
            $(pub $field: <$kind as TypeIter<$crate::context::Program<'info>>>::Target,)*

            // Store a reference to the full list and program ID.
            all:        &'a [AccountInfo<'info>],
            program_id: &'a Pubkey,

            // The 'info added to the struct is only used for field type lookup.
            _info:   ::std::marker::PhantomData<&'info ()>,
        }

        // Generate Solitaire functions on top of the defined structure.
        impl<'a, 'info> $name<'a, 'info> {
            // Build the structure from a list of solana AccountInfo.
            pub fn parse<T>(
                prog: &'a solana_program::pubkey::Pubkey,
                accs: &'a [solana_program::account_info::AccountInfo<'info>],
                data: &'a T
            ) -> $crate::error::Result<Self> {
                use $crate::context::Program;
                use $crate::iterator::TypeIter;
                use solana_program::account_info::next_account_info;

                let mut iter = accs.iter();
                Ok(Self {
                    $(
                        $field: <$kind>::iter(Program {
                            mutable:    false,
                            program_id: *prog,
                            info:       next_account_info(&mut iter)?.clone(),
                        })?,
                    )*

                    all:        accs,
                    program_id: prog,
                    _info:      ::std::marker::PhantomData,
                })
            }

            // Persist the structure by writing each field into its related account.
            pub fn persist(&self, prog: &solana_program::pubkey::Pubkey) -> $crate::error::Result<()> {
                use $crate::accounts::Persist;
                use $crate::context::Program;
                use $crate::iterator::TypeIter;
                $( Persist::persist(&self.$field, prog)?; )*
                Ok(())
            }
        }

        // Generate a client version of the structure with Keypair/Pubkey fields. Along with a
        // function that can create an `Instruction` for clients.
        #[cfg(feature = "client")]
        pub mod client {
            use super::*;

            use borsh::BorshSerialize;
            use solana_program::account_info::AccountInfo;
            use solana_program::instruction::AccountMeta;
            use solana_program::pubkey::Pubkey;
            use solana_sdk::instruction::Instruction;
            use solana_sdk::signer::Signer as SolanaSigner;

            // Struct with Pubkey/Keypair.
            pub struct $name {
                $(pub $field: <$kind as TypeIter<WASM>>::Target,)*
            }

            // Function to generate an instruction for this handler.
            pub fn $callback(
                this: Pubkey,
                accs: $name,
                args: $data,
            ) -> Instruction {
                Instruction {
                    program_id: this,
                    accounts: vec![
                        $(
                            <$kind>::iter(Client {
                                key:     accs.$field,
                                mutable: false,
                                signer:  false,
                            }).unwrap(),
                        )*
                    ],
                    data: args.try_to_vec().unwrap(),
                }
            }
        }
    };
}
