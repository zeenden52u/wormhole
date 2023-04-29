import * as mock from "@certusone/wormhole-sdk/lib/cjs/mock";
import {
  fromB64,
  normalizeSuiObjectId,
  RawSigner,
  SUI_CLOCK_OBJECT_ID,
  TransactionArgument,
  TransactionBlock,
} from "@mysten/sui.js";
import { execSync } from "child_process";
import { GUARDIAN_PRIVATE_KEY } from "./consts";
import { packageId } from "./dynamicFields";
import { packageV1 } from "./types";

export function buildForBytecodeAndDigest(packagePath: string) {
  const buildOutput: {
    modules: string[];
    dependencies: string[];
    digest: number[];
  } = JSON.parse(
    execSync(
      `sui move build --dump-bytecode-as-base64 -p ${packagePath} 2> /dev/null`,
      { encoding: "utf-8" }
    )
  );
  return {
    modules: buildOutput.modules.map((m: string) => Array.from(fromB64(m))),
    dependencies: buildOutput.dependencies.map((d: string) =>
      normalizeSuiObjectId(d)
    ),
    digest: Buffer.from(buildOutput.digest),
  };
}

export async function upgradeWormhole(
  signer: RawSigner,
  wormholeStateId: string,
  modules: number[][],
  dependencies: string[],
  upgradeVaa: Buffer
) {
  const provider = signer.provider;
  const wormholeV1 = await packageV1(provider, wormholeStateId);
  const wormholePackage = await packageId(
    signer.provider,
    wormholeStateId,
    `${wormholeV1}::package_utils`,
    "PendingPackage"
  );

  const tx = new TransactionBlock();

  const governanceWitness = `${wormholeV1}::upgrade_contract::GovernanceWitness`;
  addUpgradeContractCalls(
    tx,
    wormholePackage,
    wormholePackage,
    wormholeStateId,
    wormholeStateId,
    modules,
    dependencies,
    upgradeVaa,
    governanceWitness
  );

  return signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });
}

export async function upgradeTokenBridge(
  signer: RawSigner,
  tokenBridgeStateId: string,
  wormholeStateId: string,
  modules: number[][],
  dependencies: string[],
  upgradeVaa: Buffer
) {
  const provider = signer.provider;
  const stateIds = [tokenBridgeStateId, wormholeStateId];

  const [tokenBridgeV1, wormholeV1] = await Promise.all(
    stateIds.map((stateId) => packageV1(provider, stateId))
  );
  const [tokenBridgePackage, wormholePackage] = await Promise.all(
    stateIds.map((stateId) =>
      packageId(
        signer.provider,
        stateId,
        `${wormholeV1}::package_utils`,
        "PendingPackage"
      )
    )
  );

  const tx = new TransactionBlock();

  const governanceWitness = `${tokenBridgeV1}::upgrade_contract::GovernanceWitness`;
  addUpgradeContractCalls(
    tx,
    tokenBridgePackage,
    wormholePackage,
    tokenBridgeStateId,
    wormholeStateId,
    modules,
    dependencies,
    upgradeVaa,
    governanceWitness
  );

  return signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });
}

export function makeWormholeUpgradeContractVaa(
  governance: mock.GovernanceEmitter,
  digest: Buffer
) {
  const timestamp = 12345678;
  const published = governance.publishWormholeUpgradeContract(
    timestamp,
    2,
    "0x" + digest.toString("hex")
  );
  // Overwrite target chain to be Sui's.
  published.writeUInt16BE(21, published.length - 34);

  // We will use the signed VAA when we execute the upgrade.
  const guardians = new mock.MockGuardians(0, [GUARDIAN_PRIVATE_KEY]);
  return guardians.addSignatures(published, [0]);
}

export function makeTokenBridgeUpgradeContractVaa(
  governance: mock.GovernanceEmitter,
  digest: Buffer
) {
  // We will use the signed VAA when we execute the upgrade.
  const guardians = new mock.MockGuardians(0, [GUARDIAN_PRIVATE_KEY]);

  const timestamp = 12345678;
  const published = governance.publishWormholeUpgradeContract(
    timestamp,
    2,
    "0x" + digest.toString("hex")
  );
  // Overwrite module name for TokenBridge
  const moduleName = Buffer.alloc(32);
  moduleName.write("TokenBridge", 32 - "TokenBridge".length);
  published.write(moduleName.toString(), published.length - 67);

  // Overwrite target chain to be Sui's.
  published.writeUInt16BE(21, published.length - 34);

  // Overwrite action.
  published.writeUInt8(2, 83);

  return guardians.addSignatures(published, [0]);
}

export function addVerifyVaaAndAuthorizeGovernance(
  tx: TransactionBlock,
  packageId: string,
  wormholePackage: string,
  stateId: string,
  wormholeStateId: string,
  upgradeVaa: Buffer,
  governanceWitness: string
): TransactionArgument {
  const [verifiedVaa] = tx.moveCall({
    target: `${wormholePackage}::vaa::parse_and_verify`,
    arguments: [
      tx.object(wormholeStateId),
      tx.pure(Array.from(upgradeVaa)),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  const [decreeTicket] = tx.moveCall({
    target: `${packageId}::upgrade_contract::authorize_governance`,
    arguments: [tx.object(stateId)],
  });

  const [decreeReceipt] = tx.moveCall({
    target: `${wormholePackage}::governance_message::verify_vaa`,
    arguments: [tx.object(wormholeStateId), verifiedVaa, decreeTicket],
    typeArguments: [governanceWitness],
  });

  return decreeReceipt;
}

function addUpgradeContractCalls(
  tx: TransactionBlock,
  packageId: string,
  wormholePackage: string,
  stateId: string,
  wormholeStateId: string,
  modules: number[][],
  dependencies: string[],
  upgradeVaa: Buffer,
  governanceWitness: string
) {
  const decreeReceipt = addVerifyVaaAndAuthorizeGovernance(
    tx,
    packageId,
    wormholePackage,
    stateId,
    wormholeStateId,
    upgradeVaa,
    governanceWitness
  );

  // Authorize upgrade.
  const [upgradeTicket] = tx.moveCall({
    target: `${packageId}::upgrade_contract::authorize_upgrade`,
    arguments: [tx.object(stateId), decreeReceipt],
  });

  // Build and generate modules and dependencies for upgrade.
  const [upgradeReceipt] = tx.upgrade({
    modules,
    dependencies,
    packageId,
    ticket: upgradeTicket,
  });

  // Commit upgrade.
  tx.moveCall({
    target: `${packageId}::upgrade_contract::commit_upgrade`,
    arguments: [tx.object(stateId), upgradeReceipt],
  });
}
