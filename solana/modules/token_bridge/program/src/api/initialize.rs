use crate::{
    accounts::ConfigAccount,
    types::*,
};
use solana_program::{
    account_info::AccountInfo,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};
use solitaire::{
    AccountState::*,
    CreationLamports::Exempt,
    *,
};
use std::ops::{
    Deref,
    DerefMut,
};

accounts!(Initialize {
    payer:  Mut<Signer<AccountInfo<'info>>>,
    config: Mut<ConfigAccount<'info, { Uninitialized }>>,
});

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct InitializeData {
    pub bridge: Pubkey,
}

pub fn initialize(
    ctx: &ExecutionContext,
    accs: &mut Initialize,
    data: InitializeData,
) -> Result<()> {
    // Create the config account
    accs.config.create(ctx, accs.payer.key, Exempt)?;
    accs.config.wormhole_bridge = data.bridge;
    Ok(())
}
