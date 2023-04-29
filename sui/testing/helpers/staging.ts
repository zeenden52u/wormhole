import * as mock from "@certusone/wormhole-sdk/lib/cjs/mock";
import {
  RawSigner,
  SUI_CLOCK_OBJECT_ID,
  TransactionBlock,
} from "@mysten/sui.js";
import { execSync } from "child_process";
import * as fs from "fs";
import {
  DEPLOY_CMD,
  ETHEREUM_TOKEN_BRIDGE,
  GUARDIAN_PRIVATE_KEY,
} from "./consts";
import { packageId } from "./dynamicFields";
import { tokenBridgeModules, wormholeModules } from "./types";
import { addPublishMessage } from "./wormhole/publishMessage";

export function setUpStagingDirectory(srcPath: string, stagingPath: string) {
  if (!fs.existsSync(stagingPath)) {
    fs.mkdirSync(stagingPath);
  }

  // Stage initial deploys.
  const dstWormholePath = `${stagingPath}/wormhole`;
  setUpContractDirectory(`${srcPath}/wormhole`, dstWormholePath);

  const dstTokenBridgePath = `${stagingPath}/token_bridge`;
  setUpContractDirectory(`${srcPath}/token_bridge`, dstTokenBridgePath);

  // Just to get worm CLI to work.
  const dstExamples = `${stagingPath}/examples`;
  if (!fs.existsSync(dstExamples)) {
    fs.mkdirSync(dstExamples);
  }
  for (const subdir of ["coins", "core_messages"]) {
    setUpContractDirectory(
      `${srcPath}/examples/${subdir}`,
      `${dstExamples}/${subdir}`
    );
  }
}

export function deployContracts(privateKey: string, contractsPath: string) {
  let deployOutput: string | undefined = undefined;
  while (deployOutput === undefined) {
    const output = execSync(
      `cd ${contractsPath} && ${DEPLOY_CMD} -k ${privateKey} 2>&1 | tee -a`,
      { encoding: "utf-8" }
    );
    if (
      !output.includes("Error") ||
      output.includes("Error: Couldn't find .env file at")
    ) {
      deployOutput = output;
    }
  }

  const lines = deployOutput.split("\n");

  let wormholeAddress: string | undefined,
    tokenBridgeAddress: string | undefined,
    wormholeStateId: string | undefined,
    tokenBridgeStateId: string | undefined;
  let numPublished = 0;
  let numIds = 0;
  for (const line of lines) {
    if (numIds == 4) {
      break;
    }
    // Get Wormhole address
    if (line.includes("Published to 0x")) {
      const addr = line.split("Published to ")[1];
      if (numPublished == 0) {
        wormholeAddress = addr;
      } else if (numPublished == 1) {
        tokenBridgeAddress = addr;
      }
      ++numPublished;
      ++numIds;
    } else if (line.includes("Core bridge state object ID 0x")) {
      wormholeStateId = line.split("Core bridge state object ID ")[1];
      ++numIds;
    } else if (line.includes("Token bridge state object ID 0x")) {
      tokenBridgeStateId = line.split("Token bridge state object ID ")[1];
      ++numIds;
    }
  }

  if (
    wormholeAddress === undefined ||
    tokenBridgeAddress === undefined ||
    wormholeStateId === undefined ||
    tokenBridgeStateId === undefined
  ) {
    throw new Error("some ids not found");
  }

  return {
    wormholeAddress,
    tokenBridgeAddress,
    wormholeStateId,
    tokenBridgeStateId,
  };
}

function setUpContractDirectory(
  srcContractPath: string,
  dstContractPath: string
) {
  if (!fs.existsSync(dstContractPath)) {
    fs.mkdirSync(dstContractPath);
  }

  fs.cpSync(srcContractPath, dstContractPath, { recursive: true });

  // Remove irrelevant files. This part is not necessary, but is helpful
  // for debugging a clean package directory.
  const keepThese = ["sources", "Move.toml", "Move.devnet.toml"];
  for (const basename of fs.readdirSync(dstContractPath)) {
    if (!keepThese.includes(basename)) {
      fs.rmSync(`${dstContractPath}/${basename}`, {
        recursive: true,
        force: true,
      });
    }
  }
}

export function ovewriteMoveToml(contractPath: string, moveToml: string) {
  const moveTomlPath = `${contractPath}/Move.toml`;
  fs.writeFileSync(moveTomlPath, moveToml, "utf-8");
}

export function prepareWormholeBuild(
  stagingPath: string,
  wormholeAddress?: string,
  publishedAt?: string
) {
  const wormholePath = `${stagingPath}/wormhole`;
  const moveTomlPath = `${wormholePath}/Move.toml`;
  const moveToml = fs.readFileSync(moveTomlPath, { encoding: "utf-8" });

  const lines = moveToml.split("\n");

  // First scan to make sure there is no published-at written.
  {
    const found = lines.find((line) => line.includes("published-at"));
    if (found !== undefined) {
      throw new Error(
        "`published-at` found in Move.toml. Please use clean Move.toml"
      );
    }

    // Now write published-at if we require it.
    if (publishedAt !== undefined) {
      const idx = lines.findIndex((line) => line.includes(`name = "Wormhole"`));
      lines.splice(idx + 1, 0, `published-at = "${publishedAt}"`);
    }
  }

  // Now replace the address
  if (wormholeAddress === undefined) {
    wormholeAddress = "0x0";
  }
  const idx = 1 + lines.findIndex((line) => line.includes("[addresses]"));
  lines[idx] = lines[idx].replace(
    /wormhole = "(?:_|0x[0-9a-f]+)"/,
    `wormhole = "${wormholeAddress}"`
  );

  // Finally overwrite Move.toml.
  ovewriteMoveToml(wormholePath, lines.join("\n"));

  return moveToml;
}

export function prepareTokenBridgeBuild(
  stagingPath: string,
  wormholeAddress: string,
  wormholePublishedAt: string,
  tokenBridgeAddress?: string
) {
  // First modify Wormhole Move.toml
  const wormholeMoveToml = prepareWormholeBuild(
    stagingPath,
    wormholeAddress,
    wormholePublishedAt
  );

  const tokenBridgePath = `${stagingPath}/token_bridge`;
  const moveTomlPath = `${tokenBridgePath}/Move.toml`;
  const moveToml = fs.readFileSync(moveTomlPath, { encoding: "utf-8" });

  const lines = moveToml.split("\n");

  // First scan to make sure there is no published-at written.
  {
    const found = lines.find((line) => line.includes("published-at"));
    if (found !== undefined) {
      throw new Error(
        "`published-at` found in Move.toml. Please use clean Move.toml"
      );
    }
  }

  // Now replace the address
  if (tokenBridgeAddress === undefined) {
    tokenBridgeAddress = "0x0";
  }
  const idx = 1 + lines.findIndex((line) => line.includes("[addresses]"));
  lines[idx] = lines[idx].replace(
    /token_bridge = "(?:_|0x[0-9a-f]+)"/,
    `token_bridge = "${tokenBridgeAddress}"`
  );

  // Finally overwrite Move.toml.
  ovewriteMoveToml(tokenBridgePath, lines.join("\n"));

  return [moveToml, wormholeMoveToml];
}

export async function setUpTokenBridgeRegistries(
  signer: RawSigner,
  tokenBridgeStateId: string,
  wormholeStateId: string,
  modulePackageUtils: `${string}::${string}`,
  governance: mock.GovernanceEmitter
) {
  const [wormholePackage, tokenBridgePackage] = await Promise.all([
    packageId(signer.provider, wormholeStateId, modulePackageUtils),
    packageId(signer.provider, tokenBridgeStateId, modulePackageUtils),
  ]);

  const { moduleGovernanceMessage } = wormholeModules(wormholePackage);
  const { moduleRegisterChain } = tokenBridgeModules(tokenBridgePackage);

  // TODO: use wormhole sdk method
  await registerEthereumChain(
    signer,
    tokenBridgeStateId,
    wormholeStateId,
    moduleGovernanceMessage,
    moduleRegisterChain,
    governance,
    tokenBridgePackage,
    wormholePackage
  ).then((result) => {
    if (result.effects?.status.status !== "success") {
      throw new Error("failed transaction");
    }
  });

  // TODO: use wormhole sdk method
  await attestSui(
    signer,
    tokenBridgeStateId,
    wormholeStateId,
    modulePackageUtils,
    tokenBridgePackage,
    wormholePackage
  ).then((result) => {
    if (result.effects?.status.status !== "success") {
      throw new Error("failed transaction");
    }
  });
}

export async function attestSui(
  signer: RawSigner,
  tokenBridgeStateId: string,
  wormholeStateId: string,
  modulePackageUtils: `${string}::${string}`,
  tokenBridgePackage?: string,
  wormholePackage?: string
) {
  if (tokenBridgePackage === undefined) {
    tokenBridgePackage = await packageId(
      signer.provider,
      tokenBridgeStateId,
      modulePackageUtils
    );
  }
  if (wormholePackage === undefined) {
    wormholePackage = await packageId(
      signer.provider,
      wormholeStateId,
      modulePackageUtils
    );
  }

  const coinType = "0x2::sui::SUI";
  const tx = new TransactionBlock();

  const suiMetadata = await signer.provider.getCoinMetadata({
    coinType,
  });

  const nonce = 69;
  const [messageTicket] = tx.moveCall({
    target: `${tokenBridgePackage}::attest_token::attest_token`,
    arguments: [
      tx.object(tokenBridgeStateId),
      tx.object(suiMetadata?.id!),
      tx.pure(nonce),
    ],
    typeArguments: [coinType],
  });
  addPublishMessage(tx, wormholePackage, wormholeStateId, messageTicket);

  return signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showEffects: true,
    },
  });
}

export async function registerEthereumChain(
  signer: RawSigner,
  tokenBridgeStateId: string,
  wormholeStateId: string,
  modulePackageUtils: `${string}::${string}`,
  moduleRegisterChain: `${string}::${string}`,
  governance: mock.GovernanceEmitter,
  tokenBridgePackage?: string,
  wormholePackage?: string
) {
  if (tokenBridgePackage === undefined) {
    tokenBridgePackage = await packageId(
      signer.provider,
      tokenBridgeStateId,
      modulePackageUtils
    );
  }
  if (wormholePackage === undefined) {
    wormholePackage = await packageId(
      signer.provider,
      wormholeStateId,
      modulePackageUtils
    );
  }
  // Set up register chain governance VAA.
  const timestamp = 23456789;
  const published = governance.publishTokenBridgeRegisterChain(
    timestamp,
    2,
    ETHEREUM_TOKEN_BRIDGE
  );

  const guardians = new mock.MockGuardians(0, [GUARDIAN_PRIVATE_KEY]);
  const registerChainVaa = guardians.addSignatures(published, [0]);

  const tx = new TransactionBlock();

  const [verifiedVaa] = tx.moveCall({
    target: `${wormholePackage}::vaa::parse_and_verify`,
    arguments: [
      tx.object(wormholeStateId),
      tx.pure(Array.from(registerChainVaa)),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  const [decreeTicket] = tx.moveCall({
    target: `${tokenBridgePackage}::register_chain::authorize_governance`,
    arguments: [tx.object(tokenBridgeStateId)],
  });
  const [decreeReceipt] = tx.moveCall({
    target: `${wormholePackage}::governance_message::verify_vaa`,
    arguments: [tx.object(wormholeStateId), verifiedVaa, decreeTicket],
    typeArguments: [`${moduleRegisterChain}::GovernanceWitness`],
  });

  // Register chain.
  tx.moveCall({
    target: `${tokenBridgePackage}::register_chain::register_chain`,
    arguments: [tx.object(tokenBridgeStateId), decreeReceipt],
  });

  return signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showEffects: true,
    },
  });
}
