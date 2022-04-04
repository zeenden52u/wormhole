use cosmwasm_std::{
    entry_point,
    to_binary,
    Binary,
    CosmosMsg,
    Deps,
    DepsMut,
    Env,
    MessageInfo,
    Reply,
    Response,
    StdError,
    StdResult,
    SubMsg,
    WasmMsg,
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

use token_bridge_terra::{
    msg::ExecuteMsg as TokenBridgeExecuteMsg,
    state::TransferWithPayloadInfo,
    contract::verify_and_parse_vaa,
};
use wormhole::{
    state::ParsedVAA,
};

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
        ExecuteMsg::CompleteTransferWithPayload { data } => {
            complete_transfer_with_payload(deps, env, info, &data)
        },
    }
}

fn complete_transfer_with_payload(
    mut deps: DepsMut,
    env: Env,
    info: MessageInfo,
    data: &Binary,
) -> StdResult<Response> {
    let cfg = config_read(deps.storage).load()?;

    let mut messages = vec![SubMsg::reply_on_success(
        CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: cfg.token_bridge_contract,
            msg: to_binary(&TokenBridgeExecuteMsg::CompleteTransferWithPayload {
                data: data.clone(), relayer: info.sender.to_string()
            })?,
            funds: vec![],
        }),
        1,
    ),];

    let parsed: ParsedVAA = verify_and_parse_vaa(
        deps.branch(), cfg.wormhole_contract, env.block.time.seconds(), data)?;
    let transfer_payload = TransferWithPayloadInfo::get_payload(&parsed.payload);

    Ok(Response::new()
        .add_submessages(messages)
        .add_attribute("action", "complete_transfer_with_payload")
        .add_attribute("transfer_payload", Binary::from(transfer_payload).to_base64()))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn reply(_deps: DepsMut, _env: Env, _msg: Reply) -> StdResult<Response> {
    Ok(Response::default())
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(_deps: Deps, _env: Env, _msg: QueryMsg) -> StdResult<Binary> {
    Err(StdError::generic_err("not implemented"))
}