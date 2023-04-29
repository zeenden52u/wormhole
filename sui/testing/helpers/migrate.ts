import {
  RawSigner,
  SUI_CLOCK_OBJECT_ID,
  TransactionBlock,
} from "@mysten/sui.js";
import { packageId } from "./dynamicFields";
import { packageV1 } from "./types";
import { addVerifyVaaAndAuthorizeGovernance } from "./upgrade";

export async function migrateWormhole(
  signer: RawSigner,
  wormholeStateId: string,
  upgradeVaa: Buffer
) {
  const provider = signer.provider;
  const wormholePackage = await packageV1(provider, wormholeStateId).then(
    (wormholeV1) =>
      packageId(
        provider,
        wormholeStateId,
        `${wormholeV1}::package_utils`,
        "PendingPackage"
      )
  );

  return migrateWormholeSpecified(
    signer,
    wormholePackage,
    wormholeStateId,
    upgradeVaa
  );
}

export async function migrateTokenBridge(
  signer: RawSigner,
  tokenBridgeStateId: string,
  wormholeStateId: string,
  upgradeVaa: Buffer
) {
  const provider = signer.provider;
  const [tokenBridgePackage, wormholePackage] = await packageV1(
    provider,
    wormholeStateId
  ).then((wormholeV1) =>
    Promise.all(
      [tokenBridgeStateId, wormholeStateId].map((stateId) =>
        packageId(
          provider,
          stateId,
          `${wormholeV1}::package_utils`,
          "PendingPackage"
        )
      )
    )
  );

  return migrateTokenBridgeSpecified(
    signer,
    tokenBridgePackage,
    wormholePackage,
    tokenBridgeStateId,
    wormholeStateId,
    upgradeVaa
  );
}

export async function migrateTokenBridgeSpecified(
  signer: RawSigner,
  tokenBridgePackage: string,
  wormholePackage: string,
  tokenBridgeStateId: string,
  wormholeStateId: string,
  upgradeVaa: Buffer
) {
  const tokenBridgeV1 = await packageV1(signer.provider, tokenBridgeStateId);

  const tx = new TransactionBlock();

  const governanceWitness = `${tokenBridgeV1}::upgrade_contract::GovernanceWitness`;
  const decreeReceipt = addVerifyVaaAndAuthorizeGovernance(
    tx,
    tokenBridgePackage,
    wormholePackage,
    tokenBridgeStateId,
    wormholeStateId,
    upgradeVaa,
    governanceWitness
  );

  tx.moveCall({
    target: `${tokenBridgePackage}::migrate::migrate`,
    arguments: [tx.object(tokenBridgeStateId), decreeReceipt],
  });

  return signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
    },
  });
}

export async function migrateWormholeSpecified(
  signer: RawSigner,
  wormholePackage: string,
  wormholeStateId: string,
  upgradeVaa: Buffer
) {
  const tx = new TransactionBlock();

  tx.moveCall({
    target: `${wormholePackage}::migrate::migrate`,
    arguments: [
      tx.object(wormholeStateId),
      tx.pure(Array.from(upgradeVaa)),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  return signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
    },
  });
}
