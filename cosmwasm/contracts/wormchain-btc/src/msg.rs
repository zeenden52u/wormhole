// use cosmwasm_std::Coin;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use chasm_types::api::{response};
// use crate::types::state::{When, KeyMeta, KeyData, ChildMeta, Re, SignatureMeta};


#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum AppQueryMsg {
    // ResolveAddress returns the current address that the name resolves to
    Chasm(chasm_contract::types::msg_query::Query),
}

// use cosmwasm_std::Coin;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    // chasm cluster settings
    pub cluster: chasm_contract::types::state::Cluster,
    pub address_limit: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    // Generate a BTC address
    Wallet(WalletRequest),
    Chasm(response::Response),
}


#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct MsgMigrate {
    pub comment: String
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum WalletRequest {
    GenerateKey {
        // No naming needed for any particular key.
        // Keys are temporarily assi
    },
    Sign {
        // the token transfer vaa will contain the destination address and amount
        // need to verify:
        // 1. valid token transfer
        // 2. to wormchain
        // 3. to this contract address
        vaa: Vec<u8>,
    },
}