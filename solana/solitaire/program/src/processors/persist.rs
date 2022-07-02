use solana_program::pubkey::Pubkey;

use crate::error::Result;

pub trait Persist {
    fn persist(&self, program_id: &Pubkey) -> Result<()>;
}
