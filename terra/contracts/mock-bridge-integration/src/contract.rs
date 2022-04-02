use cosmwasm_std::{
    entry_point,
    to_binary,
    Binary,
    CosmosMsg,
    Deps,
    DepsMut,
    Env,
    MessageInfo,
    QueryRequest,
    Reply,
    Response,
    StdError,
    StdResult,
    SubMsg,
    WasmMsg,
    WasmQuery,
};

use crate::{
    msg::{
        ExecuteMsg,
        InstantiateMsg,
        MigrateMsg,
        QueryMsg,
    },
    state::{
        Config,
        config,
        config_read,
    },
};

use token_bridge_terra::msg::ExecuteMsg::SubmitVaa;
use wormhole::{
    msg::QueryMsg as WormholeQueryMsg,
    state::ParsedVAA,
};

type HumanAddr = String;

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn migrate(_deps: DepsMut, _env: Env, _msg: MigrateMsg) -> StdResult<Response> {
    Ok(Response::new())
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    let state = Config {
        wormhole_contract: msg.wormhole_contract,
        token_bridge_contract: msg.token_bridge_contract,
    };
    config(deps.storage).save(&state)?;

    Ok(Response::default())
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg) -> StdResult<Response> {
    match msg {
        ExecuteMsg::CompleteTransferWithPayload { data } => complete_transfer_with_payload(deps, env, info, &data),
    }
}

fn complete_transfer_with_payload(
    mut deps: DepsMut,
    env: Env,
    info: MessageInfo,
    data: &Binary,
) -> StdResult<Response> {
    let cfg = config_read(deps.storage).load()?;
    
    let messages = vec![SubMsg::reply_on_success(
        CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: cfg.token_bridge_contract,
            msg: to_binary(&SubmitVaa { data: data.clone() })?,
            funds: vec![],
        }),
        1,
    )];

    // TODO: add counter to number of transfers made (to be queried)

    Ok(Response::new()
        .add_submessages(messages)
        .add_attribute("action", "complete_transfer_with_payload"))
}

// TODO: add reply
#[cfg_attr(not(feature = "library"), entry_point)]
pub fn reply(_deps: DepsMut, _env: Env, _msg: Reply) -> StdResult<Response> {
    // TODO: do something more meaningful in the mock?
    Ok(Response::default().add_attribute("action", "dummy_reply"))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(_deps: Deps, _env: Env, _msg: QueryMsg) -> StdResult<Binary> {
    //match msg {
    //    QueryMsg::WrappedRegistry { chain, address } => {
    //        to_binary(&query_wrapped_registry(deps, chain, address.as_slice())?)
    //    }
    //}
    to_binary(b"hey")
}

fn parse_vaa(deps: DepsMut, block_time: u64, data: &Binary) -> StdResult<ParsedVAA> {
    let cfg = config_read(deps.storage).load()?;
    let vaa: ParsedVAA = deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart {
        contract_addr: cfg.wormhole_contract.clone(),
        msg: to_binary(&WormholeQueryMsg::VerifyVAA {
            vaa: data.clone(),
            block_time,
        })?,
    }))?;
    Ok(vaa)
}