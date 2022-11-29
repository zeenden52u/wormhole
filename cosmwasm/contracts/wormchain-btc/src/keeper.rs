// use cosmwasm_std::{StdResult, Storage};
use cw_storage_plus::{Map};
use chasm_contract::types::state;


pub const TEST_APP_KEYS: Map<&str, state::Key> = Map::new("key");
pub const TEST_APP_SIGNATURES: Map<&str, Vec<u8>> = Map::new("key");

