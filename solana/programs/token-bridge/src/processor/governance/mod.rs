mod register_chain;
pub use register_chain::*;

mod secure_registered_emitter;
pub use secure_registered_emitter::*;

use crate::error::TokenBridgeError;
use anchor_lang::prelude::*;
use wormhole_raw_vaas::token_bridge::{TokenBridgeDecree, TokenBridgeGovPayload};
use wormhole_solana_vaas::zero_copy::VaaAccount;

pub fn require_valid_governance_vaa<'ctx>(
    vaa_key: &'ctx Pubkey,
    vaa: &'ctx VaaAccount<'ctx>,
) -> Result<TokenBridgeDecree<'ctx>> {
    crate::utils::vaa::require_valid_vaa_key(vaa_key)?;

    let emitter = vaa.emitter_info();
    require!(
        emitter.chain == crate::constants::GOVERNANCE_CHAIN
            && emitter.address == crate::constants::GOVERNANCE_EMITTER,
        TokenBridgeError::InvalidGovernanceEmitter
    );

    // Because emitter_chain and emitter_address getters have succeeded, we can safely unwrap this
    // payload call.
    TokenBridgeGovPayload::try_from(vaa.payload())
        .map(|msg| msg.decree())
        .map_err(|_| error!(TokenBridgeError::InvalidGovernanceVaa))
}
