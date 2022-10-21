// npx pretty-quick

const nearAPI = require("near-api-js");
const urlfetch = require("node-fetch");
const BN = require("bn.js");

async function initNear() {
  process.env["NEAR_NO_LOGS"] = "true";

  // Retrieve the validator key directly in the Tilt environment
  const response = await urlfetch("http://near:3031/validator_key.json");

  const keyFile = await response.json();

  let masterKey = nearAPI.utils.KeyPair.fromString(keyFile.secret_key);

  let keyStore = new nearAPI.keyStores.InMemoryKeyStore();

  keyStore.setKey("sandbox", "test.near", masterKey);
  keyStore.setKey("sandbox", "aurora.test.near", masterKey);

  let near = await nearAPI.connect({
    keyStore: keyStore,
    networkId: "sandbox",
    nodeUrl: "http://near:3030",
  });
  let masterAccount = new nearAPI.Account(near.connection, "test.near");

  let acct = await near.account("aurora.test.near");
  let keys = await acct.getAccessKeys();
  if (keys.length != 0) {
    await acct.deleteAccount("test.near");
    console.log("aurora.test.near deleted");
  } else {
    console.log("aurora.test.near did not exist");
  }

  let resp = await masterAccount.createAccount(
    "aurora.test.near",
    masterKey.getPublicKey(),
    new BN(10).pow(new BN(25))
  );

  console.log("aurora.test.near created");
}

initNear();
