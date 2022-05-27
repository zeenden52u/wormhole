/// This file implements a wrapper around Solana's `msg!` macro that acts as a no-op by default.
/// This allows for adding trace logs within the application that have a zero runtime cost when
/// deployed but can be used to trace execution during testing.

#[macro_export]
macro_rules! trace {
    ( $($arg:tt)* ) => { $crate::trace_impl!( $($arg)* ) };
}

#[cfg(feature = "trace")]
#[macro_export]
macro_rules! trace_impl {
    ( $($arg:tt)* ) => { solana_program::msg!( $($arg)* ) };
}

#[cfg(not(feature = "trace"))]
#[macro_export]
macro_rules! trace_impl {
    ( $($arg:tt)* ) => {};
}

