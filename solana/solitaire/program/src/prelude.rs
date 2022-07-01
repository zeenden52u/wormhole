//! Exposes a minimal API for solitaire that provides enough functionality to implement most
//! typical instruction handlers.

// Error Handling.
pub use crate::error::{
    Result,
    SolitaireError,
};

// Macros are exported from the crate root by default but we re-expose here in case callers want to
// scope the macro calls.
pub use crate::{
    pack_type,
    solitaire,
    trace,
};

// All core primitives used for account handling.
pub use crate::{
    processors::{
        keyed::Keyed,
        peel::Peel,
        persist::Persist,
        seeded::{
            invoke_seeded,
            AccountOwner,
            AccountSize,
            Creatable,
            Owned,
            Seeded,
        },
    },
    types::{
        create_account,
        AccountState::{
            self,
            Initialized,
            MaybeInitialized,
            Uninitialized,
        },
        Context,
        Data,
        Derive,
        Info,
        IsSigned::{
            self,
            NotSigned,
            SignedWithSeeds,
        },
        MaybeMut,
        Mut,
        Signer,
        Sysvar,
    },
    CreationLamports::{
        self,
        Amount,
        Exempt,
    },
    ExecutionContext,
    FromAccounts,
};
