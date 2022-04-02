use schemars::JsonSchema;
use serde::{
    Deserialize,
    Serialize,
};

use cosmwasm_std::{
    StdError,
    StdResult,
    Storage,
};
use cosmwasm_storage::{
    singleton,
    singleton_read,
    ReadonlySingleton,
    Singleton,
};

type HumanAddr = String;

pub static CONFIG_KEY: &[u8] = b"config";

// Guardian set information
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    pub wormhole_contract: HumanAddr,
    pub token_bridge_contract: HumanAddr,
}

pub fn config(storage: &mut dyn Storage) -> Singleton<Config> {
    singleton(storage, CONFIG_KEY)
}

pub fn config_read(storage: &dyn Storage) -> ReadonlySingleton<Config> {
    singleton_read(storage, CONFIG_KEY)
}

pub struct Action;

impl Action {
    pub const TRANSFER: u8 = 1;
    pub const ATTEST_META: u8 = 2;
    pub const TRANSFER_WITH_PAYLOAD: u8 = 3;
}