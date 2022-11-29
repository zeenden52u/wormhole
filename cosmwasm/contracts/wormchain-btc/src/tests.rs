

use cosmwasm_std::testing::{mock_dependencies};
extern crate tracing;

use chasm_contract::{
    test_util::{
        wait_for_heartbeat, mock_instantiate
    },
};


#[test_log::test(tokio::test(flavor = "multi_thread"))]
// 1. chasm should query a pending generate key request from the chasm contract
//    and respond correctly
// 2. chasm-contract should delete the request, store the key, and call the test app contract.
async fn chasm_generate_key() {
    let mut deps = mock_dependencies();
    let mut cluster = mock_instantiate(deps.as_mut(),3,4);
    let _request_name: String = "r1".into();
    let _key_name: String = "r1_generated_key".into();
    wait_for_heartbeat(&mut deps, &mut cluster).await;
}

