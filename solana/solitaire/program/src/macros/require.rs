//! Macro similar to that provided by anyhow. This macro is used to ensure that a given condition
//! is true. If it is not, it will return the provided error.

#[macro_export]
macro_rules! require {
    ($cond:expr, $err:expr) => {
        if !$cond {
            return Err($err);
        }
    };
}
