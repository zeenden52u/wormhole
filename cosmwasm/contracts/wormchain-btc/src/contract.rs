// This is how chasm should be used by a client.
use cosmwasm_std::{
    entry_point, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdError, StdResult,
};

use crate::{
    msg::{ExecuteMsg, MsgMigrate, AppQueryMsg},
    error::Error,
};

use chasm_contract::{
    types::state::{Key},
    types::msg_tx::{InstantiateMsg},
};
// use chasm::trussed::api::{};
use crate::keeper::{TEST_APP_KEYS, TEST_APP_SIGNATURES};
pub const CONTRACT_NAME: &str = "wormchain:btcbridge";
pub const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

pub struct ChasmClient{}
impl chasm_contract::interface::ResponseClient for ChasmClient {
    fn chasm_generated_key(&self, deps: DepsMut, _env: Env, request_name: String, key: &Key) {
        println!("request {} generated key {} with public key {:#02x?}", request_name, key.meta.name.clone(), key.public_key);
        _ = TEST_APP_KEYS.save(deps.storage, key.meta.name.as_str(), &key);
    }

    fn chasm_signed(&self, deps: DepsMut, _env: Env, request_name: String, key: &Key, signature: &Vec<u8>) {
        println!("request {} used {} to produce {:x?} signatures", request_name, key.meta.name.clone(), signature);
        _ = TEST_APP_SIGNATURES.save(deps.storage, request_name.as_str(), signature);
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, StdError> {
    let cluster = msg.cluster;
    chasm_contract::interface::set_cluster(deps.storage, cluster)?;

    Ok(Response::default())
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, Error> {
    let chasm = chasm_contract::interface::Chasm::new(ChasmClient{});
    match msg {
        ExecuteMsg::Wallet( _wallet_request ) => {
            Err(Error::NotImplemented{})
        }
        // ExecuteMsg::TestChasm ( chasm_request ) => execute_test_chasm(deps, env, info, chasm_request),
        ExecuteMsg::Chasm ( chasm_response ) => chasm.execute_response(deps, env, info, chasm_response).map_err(|err| Error::ChasmError(err)),
    }
}


#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, env: Env, msg: AppQueryMsg) -> StdResult<Binary> {
    match msg {
        AppQueryMsg::Chasm(query) => chasm_contract::interface::query(deps, env, query),
    }
}

#[entry_point]
pub fn migrate(_deps: DepsMut, _env: Env, _msg: MsgMigrate) -> Result<Response, Error> {
    // TODO check contract version is ascending
    Ok(Response::default())
}


