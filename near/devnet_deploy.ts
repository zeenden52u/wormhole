const nearAPI = require("near-api-js");
const BN = require("bn.js");
const fs = require("fs");
const fetch = require("node-fetch");
import { NodeHttpTransport } from "@improbable-eng/grpc-web-node-http-transport";

function getConfig(env: any) {
  switch (env) {
    case "sandbox":
    case "local":
      return {
        networkId: "sandbox",
        nodeUrl: "http://localhost:3030",
        masterAccount: "test.near",
        wormholeAccount: "wormhole.test.near",
        tokenAccount: "token.test.near",
        nftAccount: "nft.test.near",
        testAccount: "test.test.near",
      };
  }
  return {};
}

async function initNear() {
  let config = getConfig(process.env.NEAR_ENV || "sandbox");

  // Retrieve the validator key directly in the Tilt environment
  const response = await fetch("http://localhost:3031/validator_key.json");

  const keyFile = await response.json();

  let masterKey = nearAPI.utils.KeyPair.fromString(
    keyFile.secret_key || keyFile.private_key
  );
  let masterPubKey = masterKey.getPublicKey();

  let keyStore = new nearAPI.keyStores.InMemoryKeyStore();
  keyStore.setKey(config.networkId, config.masterAccount, masterKey);

  let near = await nearAPI.connect({
    deps: {
      keyStore,
    },
    networkId: config.networkId,
    nodeUrl: config.nodeUrl,
  });
  let masterAccount = new nearAPI.Account(
    near.connection,
    config.masterAccount
  );

  console.log(
    "Finish init NEAR masterAccount: " +
      JSON.stringify(await masterAccount.getAccountBalance())
  );

  const wormholeContract = await fs.readFileSync("./wormhole.wasm");
  const tokenContract = await fs.readFileSync("./portal.wasm");
  const nftContract = await fs.readFileSync("./nft_bridge.wasm");
  const testContract = await fs.readFileSync("./mock_bridge_integration.wasm");

  console.log("Deploying core/wormhole contract: " + config.wormholeAccount);
  let wormholeAccount = await masterAccount.createAndDeployContract(
    config.wormholeAccount,
    masterKey.getPublicKey(),
    wormholeContract,
    new BN(10).pow(new BN(27))
  );

  console.log("setting key for new wormhole contract");
  keyStore.setKey(config.networkId, config.wormholeAccount, masterKey);

  //  console.log("redeploying wormhole contract");
  //  await wormholeAccount.deployContract(wormholeContract);

  console.log("Deploying token contract: " + config.tokenAccount);
  let tokenAccount = await masterAccount.createAndDeployContract(
    config.tokenAccount,
    masterKey.getPublicKey(),
    tokenContract,
    new BN(10).pow(new BN(27))
  );

  console.log("Deploying nft bridge contract: " + config.nftAccount);
  let nftAccount = await masterAccount.createAndDeployContract(
    config.nftAccount,
    masterKey.getPublicKey(),
    nftContract,
    new BN(10).pow(new BN(27))
  );

  console.log("setting key for  token contract");
  keyStore.setKey(config.networkId, config.tokenAccount, masterKey);

  console.log("Deploying mach contract to " + config.testAccount);
  let testAccount = await masterAccount.createAndDeployContract(
    config.testAccount,
    masterKey.getPublicKey(),
    testContract,
    new BN(10).pow(new BN(27))
  );

  console.log("booting wormhole to devnet keys");

  const lines = fs.readFileSync(".env", "utf-8").split("\n");
  //  console.log(lines);
  let signers: any[] = [];

  let vaasToken: any[] = [];
  let vaasNFT: any[] = [];

  lines.forEach((line: any) => {
    let f = line.split("=");
    if (f[0] == "INIT_SIGNERS") {
      signers = eval(f[1]);
    }
    if (f[0].startsWith("REGISTER_") && f[0].endsWith("TOKEN_BRIDGE_VAA")) {
      vaasToken.push(f[1]);
    }
    if (f[0].startsWith("REGISTER_") && f[0].endsWith("NFT_BRIDGE_VAA")) {
      vaasNFT.push(f[1]);
    }
  });

  let result = await masterAccount.functionCall({
    contractId: config.wormholeAccount,
    methodName: "boot_wormhole",
    args: {
      gset: 0,
      addresses: signers,
    },
    gas: 100000000000000,
  });

  console.log("Booting up the token bridge");

  result = await masterAccount.functionCall({
    contractId: config.tokenAccount,
    methodName: "boot_portal",
    args: {
      core: config.wormholeAccount,
    },
    gas: 100000000000000,
  });

  console.log("Booting up the nft bridge");

  result = await masterAccount.functionCall({
    contractId: config.nftAccount,
    methodName: "boot_portal",
    args: {
      core: config.wormholeAccount,
    },
    gas: 100000000000000,
  });

  for (const line of vaasNFT) {
    console.log("Submitting to " + config.nftAccount + ": " + line);

    await masterAccount.functionCall({
      contractId: config.nftAccount,
      methodName: "submit_vaa",
      args: {
        vaa: line,
      },
      attachedDeposit: new BN("30000000000000000000000"),
      gas: new BN("300000000000000"),
    });
  }

  console.log("nft bridge booted");

  for (const line of vaasToken) {
    console.log("Submitting to " + config.tokenAccount + ": " + line);
    await masterAccount.functionCall({
      contractId: config.tokenAccount,
      methodName: "submit_vaa",
      args: {
        vaa: line,
      },
      attachedDeposit: new BN("30000000000000000000001"),
      gas: new BN("300000000000000"),
    });
  }

  console.log("token bridge booted");

//  console.log("deleting the master key from the token contract");
//  await tokenAccount.deleteKey(masterKey.getPublicKey());

//  console.log("deleting the master key from the nft contract");
//  await nftAccount.deleteKey(masterKey.getPublicKey());

//  console.log("deleting the master key from the wormhole contract");
//  await wormholeAccount.deleteKey(masterKey.getPublicKey());
}

initNear();
