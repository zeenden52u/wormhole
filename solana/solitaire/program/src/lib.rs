//! Solitaire is a framework intended to make building programs on the Solana blockchain easier
//! while providing a more secure foundation for building applications. It provides a mechanism for
//! verifying data passed into Solana programs as well as various utilities that make it easier to
//! work with the Solana ecosystem itself.

#![feature(adt_const_params)]
#![feature(generic_const_exprs)]
#![allow(warnings)]

// Expose all submodules.
pub mod accounts;
pub mod context;
pub mod create;
pub mod error;
pub mod iterator;
pub mod layers;
pub mod macros;

/// Solitaire Prelude
///
/// This module wholesale re-exports everything required to write a Solitaire instruction. This
/// is similar to `Prelude` in Haskell, an batteries included starting point.
mod prelude {
    pub use borsh::{
        BorshDeserialize,
        BorshSerialize,
    };
    pub use solana_program::account_info::AccountInfo;
    pub use solana_program::pubkey::Pubkey;

    pub use crate::accounts::{
        HasInfo,
        HasOwner,
    };
    pub use crate::create::{
        create_account,
        CreateArgs,
        Rent,
    };
    pub use crate::instruction;
    pub use crate::layers::*;
}

mod example {
    use crate::prelude::AccountState::*;
    use crate::prelude::*;

    #[derive(BorshDeserialize, BorshSerialize)]
    pub struct ExampleData {}

    #[derive(BorshDeserialize, BorshSerialize, Default)]
    pub struct Config {}

    impl HasOwner for Config {
    }

    instruction!(
        example,
        ExampleData,
        ExampleAccounts {
            foo: Derive<Borsh<Config, {Uninit}>>,
            bar: Info,
            pay: Info,
        }
    );

    pub fn example(
        prog: &Pubkey,
        accs: &mut ExampleAccounts,
        data: ExampleData,
    ) -> crate::error::Result<()> {
        // Create Foo account.
        let foo = accs.foo.derive("Foo")?.info();
        let bar = accs.bar.info();
        create_account(
            foo,
            accs.all,
            CreateArgs {
                payer: accs.pay.key,
                owner: accs.program_id,
                rent:  Rent::Exempt,
                size:  foo.info().data.borrow().len(),
                seeds: Some("Foo"),
            },
        )?;

        Ok(())
    }
}
