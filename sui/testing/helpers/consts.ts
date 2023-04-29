import { resolve } from "path";

export const SUI_ROOT = resolve(`${__dirname}/../..`);
export const MOCK_STAGING_ROOT = `${SUI_ROOT}/testing/staging`;

export const DEPLOY_CMD = `worm sui setup-devnet`;

export const KEYSTORE = [
  "AB522qKKEsXMTFRD2SG3Het/02S/ZBOugmcH3R1CDG6l",
  "AOmPq9B16F3W3ijO/4s9hI6v8LdiYCawKAW31PKpg4Qp",
  "AOLhc0ryVWnD5LmqH3kCHruBpVV+68EWjEGu2eC9gndK",
  "AKCo1FyhQ0zUpnoZLmGJJ+8LttTrt56W87Ho4vBF+R+8",
  "AGA20wtGcwbcNAG4nwapbQ5wIuXwkYQEWFUoSVAxctHb",
  "AOL19ASNl1MAv0sf+mG4I43YwF9vVhmAu+K7s+neQVL5",
  "ADzosdnte8XHftZ84JbebQYxsKDRnyKU+0Y773XfC6Vf",
  "ANahoS6pZAO3NSOC3YFh2mVZ1nXlhgsl/f1X/wuIWNsC",
  "AB51j2QISNC5i6q7RvSqWEamaFdDtbvNdlhMpjM5orgF",
  "AJhFF5+GLOmF8UGe5jNurKh5sW1pmsUKFdZ2nBTF4mRk",
];

// guardian signer
export const GUARDIAN_PRIVATE_KEY =
  "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";

// wormhole
export const WORMHOLE_STATE_ID =
  "0xc561a02a143575e53b87ba6c1476f053a307eac5179cb1c8121a3d3b220b81c1";

// token bridge
export const TOKEN_BRIDGE_STATE_ID =
  "0x1c8de839f6331f2d745eb53b1b595bc466b4001c11617b0b66214b2e25ee72fc";

// governance
export const GOVERNANCE_EMITTER =
  "0000000000000000000000000000000000000000000000000000000000000004";

// file encoding
export const UTF8: BufferEncoding = "utf-8";

// foreign
export const ETHEREUM_TOKEN_BRIDGE =
  "0x00000000000000000000000000000000deadbeef";

// coin types
export const COIN_TYPE_SUI = "0x2::sui::SUI";
