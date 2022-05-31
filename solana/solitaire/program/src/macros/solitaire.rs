//! This is our main codegen macro. It takes as input a list of enum-like variants mapping field
//! types to function calls. The generated code produces:
//!
//! - An `Instruction` enum with the enum variants passed in.
//! - A set of functions which take as arguments the enum fields.
//! - A Dispatcher that deserializes bytes into the enum and dispatches the function call.
//! - A set of client calls scoped to the module `api` that can generate instructions.

#[macro_export]
macro_rules! solitaire {
    { $($row:ident => $fn:ident),+ $(,)* } => {
        pub mod instruction {
            use super::*;
            use borsh::{
                BorshDeserialize,
                BorshSerialize,
            };
            use solana_program::{
                account_info::AccountInfo,
                entrypoint::ProgramResult,
                program_error::ProgramError,
                pubkey::Pubkey,
            };
            use solitaire::{
                trace,
                ExecutionContext,
                Persist,
                Result,
                SolitaireError,
            };

            $(
                // Generated module wrapping instruction handler.
                //
                // These are needed to force the compiler to generate a new function that has not
                // been inlined, this provides a new stack frame. Without this, the stack frame for
                // deserialization and the handler is the same as that used by solitaire, leading
                // to bust stacks.
                #[allow(non_snake_case)]
                pub mod $row {
                    use super::*;

                    #[inline(never)]
                    pub fn execute(p: &Pubkey, a: &[AccountInfo], d: &[u8]) -> Result<()> {
                        let ix_data = BorshDeserialize::try_from_slice(d).map_err(|e| SolitaireError::InstructionDeserializeFailed(e))?;
                        let mut accounts = crate::$row::parse(p, a, &())?;
                        $fn(&ExecutionContext{program_id: p, accounts: a}, &mut accounts, ix_data)?;
                        crate::$row::persist(&accounts, p)?;
                        Ok(())
                    }
                }
            )*

            /// Generated:
            /// This Instruction contains a 1-1 mapping for each enum variant to function call. The
            /// function calls can be found below in the `api` module.
            #[repr(u8)]
            #[derive(BorshSerialize, BorshDeserialize)]
            pub enum Instruction {
                $($row,)*
            }

            /// This entrypoint is generated from the enum above, it deserializes incoming bytes
            /// and automatically dispatches to the correct method.
            pub fn dispatch(p: &Pubkey, a: &[AccountInfo], d: &[u8]) -> Result<()> {
                match d[0] {
                    $(
                        n if n == Instruction::$row as u8 => $row::execute(p, a, &d[1..]),
                    )*

                    other => {
                        Err(SolitaireError::UnknownInstruction(other))
                    }
                }
            }

            pub fn solitaire(p: &Pubkey, a: &[AccountInfo], d: &[u8]) -> ProgramResult {
                trace!("{} {} built with {}", env!("CARGO_PKG_NAME"), env!("CARGO_PKG_VERSION"), solitaire::PKG_NAME_VERSION);
                if let Err(err) = dispatch(p, a, d) {
                    solana_program::msg!("Error: {:?}", err);
                    return Err(err.into());
                }
                Ok(())
            }
        }

        pub use instruction::solitaire;
        #[cfg(not(feature = "no-entrypoint"))]
        solana_program::entrypoint!(solitaire);
    }
}
