//! Exposes an API implementation depending on which feature flags have been toggled for the
//! library. Check submodules for chain runtime specific documentation.
use std::convert::TryFrom; // Remove in 2021

/// Chain is a mapping of Wormhole supported chains to their u16 representation. These are
/// universally defined among all Wormhole contracts.
#[repr(u16)]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Chain {
    Any          = 0,
    Solana       = 1,
    Ethereum     = 2,
    TerraClassic = 3,
    Binance      = 4,
    Polygon      = 5,
    Avalanche    = 6,
    Oasis        = 7,
    Algorand     = 8,
    Aurora       = 9,
    Fantom       = 10,
    Karura       = 11,
    Acala        = 12,
    Klaytn       = 13,
    Celo         = 14,
    Near         = 15,
    Terra        = 18,
}

impl TryFrom<u16> for Chain {
    type Error = ();

    #[rustfmt::skip]
    fn try_from(other: u16) -> Result<Chain, Self::Error> {
        use Chain::*;

        match other {
            0  => Ok(Any),
            1  => Ok(Solana),
            2  => Ok(Ethereum),
            3  => Ok(TerraClassic),
            4  => Ok(Binance),
            5  => Ok(Polygon),
            6  => Ok(Avalanche),
            7  => Ok(Oasis),
            8  => Ok(Algorand),
            9  => Ok(Aurora),
            10 => Ok(Fantom),
            11 => Ok(Karura),
            12 => Ok(Acala),
            13 => Ok(Klaytn),
            14 => Ok(Celo),
            15 => Ok(Near),
            18 => Ok(Terra),
            _  => Err(()),
        }
    }
}

impl Default for Chain {
    fn default() -> Self {
        Self::Any
    }
}
