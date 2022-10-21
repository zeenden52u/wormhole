import { keccak256 } from '@ethersproject/keccak256';
import { arrayify as parseHexString } from '@ethersproject/bytes';
const { parseSeedPhrase, generateSeedPhrase } = require("near-seed-phrase");

const nearAPI = require("near-api-js");
const BN = require("bn.js");

async function initNear() {
    let aurora_address = keccak256(Buffer.from("devnet.test.near")).slice(26, 66)
    let addr = parseHexString("0x"+aurora_address)

    console.log(aurora_address)
    console.log(addr)
    
    let da = parseSeedPhrase(
      "weather opinion slam purpose access artefact word orbit matter rice poem badge"
    );
    console.log(da);

  let masterKey = nearAPI.utils.KeyPair.fromString(da.secretKey);

  let keyStore = new nearAPI.keyStores.InMemoryKeyStore();

  keyStore.setKey("sandbox", "test.near", masterKey);
  keyStore.setKey("sandbox", "aurora.test.near", masterKey);
  keyStore.setKey("sandbox", "devnet.test.near", masterKey);

  let near = await nearAPI.connect({
    keyStore: keyStore,
    networkId: "sandbox",
    nodeUrl: "http://localhost:3030",
  });

    let masterAccount = new nearAPI.Account(near.connection, "devnet.test.near");
    let auroraAccount = new nearAPI.Account(near.connection, "aurora.test.near");

  let acct = await near.account("aurora.test.near");
  let keys = await acct.getAccessKeys();
    console.log(keys);

    console.log(JSON.stringify(await masterAccount.getAccountBalance()))

    // let args: ([u8; 20], u64, u64) = io.read_input_borsh().sdk_expect(errors::ERR_ARGS);
    //let address = Address::from_array(args.0);
    //let nonce = U256::from(args.1);
    //let balance = NEP141Wei::new(u128::from(args.2));

    const nonceConst = Math.random() * 100000;
    const nonce = Buffer.alloc(8);
    nonce.writeUInt32LE(nonceConst, 0);

    const bal = Buffer.alloc(8);
    bal.writeUInt32LE(100, 0);

    var mintData = new Uint8Array(20+8+8);
    mintData.set(addr);
    mintData.set(nonce, 20);
    mintData.set(bal, 28);

    let result = await masterAccount.functionCall({
    contractId: "aurora.test.near",
    methodName: "mint_account",
    args: mintData,
    gas: 90_000_000_000_000,
  });
}

initNear();
