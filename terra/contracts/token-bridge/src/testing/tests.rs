use cosmwasm_std::{
    Binary,
    StdResult,
};

use crate::contract::{
    build_asset_id,
    build_native_id,
};

#[test]
fn binary_check() -> StdResult<()> {
    let x = vec![
        1u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 96u8, 180u8, 94u8, 195u8, 0u8, 0u8,
        0u8, 1u8, 0u8, 3u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 38u8,
        229u8, 4u8, 215u8, 149u8, 163u8, 42u8, 54u8, 156u8, 236u8, 173u8, 168u8, 72u8, 220u8,
        100u8, 90u8, 154u8, 159u8, 160u8, 215u8, 0u8, 91u8, 48u8, 44u8, 48u8, 44u8, 51u8, 44u8,
        48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8,
        48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 53u8, 55u8, 44u8, 52u8,
        54u8, 44u8, 50u8, 53u8, 53u8, 44u8, 53u8, 48u8, 44u8, 50u8, 52u8, 51u8, 44u8, 49u8,
        48u8, 54u8, 44u8, 49u8, 50u8, 50u8, 44u8, 49u8, 49u8, 48u8, 44u8, 49u8, 50u8, 53u8,
        44u8, 56u8, 56u8, 44u8, 55u8, 51u8, 44u8, 49u8, 56u8, 57u8, 44u8, 50u8, 48u8, 55u8,
        44u8, 49u8, 48u8, 52u8, 44u8, 56u8, 51u8, 44u8, 49u8, 49u8, 57u8, 44u8, 49u8, 50u8,
        55u8, 44u8, 49u8, 57u8, 50u8, 44u8, 49u8, 52u8, 55u8, 44u8, 56u8, 57u8, 44u8, 48u8,
        44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8,
        44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8,
        44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8,
        44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8,
        44u8, 48u8, 44u8, 51u8, 44u8, 50u8, 51u8, 50u8, 44u8, 48u8, 44u8, 51u8, 44u8, 48u8,
        44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8,
        44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 48u8, 44u8, 53u8, 51u8, 44u8, 49u8, 49u8,
        54u8, 44u8, 52u8, 56u8, 44u8, 49u8, 49u8, 54u8, 44u8, 49u8, 52u8, 57u8, 44u8, 49u8,
        48u8, 56u8, 44u8, 49u8, 49u8, 51u8, 44u8, 56u8, 44u8, 48u8, 44u8, 50u8, 51u8, 50u8,
        44u8, 52u8, 57u8, 44u8, 49u8, 53u8, 50u8, 44u8, 49u8, 44u8, 50u8, 56u8, 44u8, 50u8,
        48u8, 51u8, 44u8, 50u8, 49u8, 50u8, 44u8, 50u8, 50u8, 49u8, 44u8, 50u8, 52u8, 49u8,
        44u8, 56u8, 53u8, 44u8, 49u8, 48u8, 57u8, 93u8,
    ];
    let b = Binary::from(x.clone());
    let y: Vec<u8> = b.into();
    assert_eq!(x, y);
    Ok(())
}

#[test]
fn build_native_and_asset_ids() -> StdResult<()> {
    let denom = "uusd";
    let native_id = build_native_id(denom);

    let expected_native_id = vec![
          0u8,   0u8,   0u8,   0u8,   0u8,   0u8,   0u8,   0u8,
          0u8,   0u8,   0u8,   0u8,   0u8,   0u8,   0u8,   0u8,
        117u8, 117u8, 115u8, 100u8,
    ];
    assert_eq!(&native_id, &expected_native_id, "native_id != expected");

    // weth
    let chain = 2u16;
    let token_address = "000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    let token_address = hex::decode(token_address).unwrap();
    let asset_id = build_asset_id(chain, token_address.as_slice());

    let expected_asset_id = vec![
        171u8, 106u8, 233u8,  80u8,  14u8, 139u8, 124u8,  78u8,
        181u8,  77u8, 142u8,  76u8, 109u8,  81u8,  55u8, 100u8,
        139u8, 159u8,  42u8,  85u8, 172u8, 234u8,   0u8, 114u8,
         11u8,  82u8,  40u8,  40u8,  50u8,  73u8, 211u8, 135u8,
    ];
    assert_eq!(&asset_id, &expected_asset_id, "asset_id != expected");
    Ok(())
}