//! A collection of Solitaire layers to declare Solana accounts with.
//!
//! This module defines a set of layers that can be used to enforce constraints on Solana program
//! accounts. The leaf types are used as the inner-most type, and layers as wrappers to add more
//! constraints to the account.

// Leaves
pub mod borsh_data;
pub mod info;
pub mod pack_data;

// Layers
pub mod derive;
pub mod key;
pub mod mutable;
pub mod signer;

// Re-Expose all.
pub use borsh_data::*;
pub use derive::*;
pub use info::*;
pub use key::*;
pub use mutable::*;
pub use pack_data::*;
pub use signer::*;
