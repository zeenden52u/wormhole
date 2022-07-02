//! The FeeCollector is a simple account that collects SOL fees.

use solitaire::prelude::*;

pub type FeeCollector<'a> = Derive<Info<'a>, "fee_collector">;
