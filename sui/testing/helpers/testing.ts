import { RawSigner, TransactionBlock } from "@mysten/sui.js";
import { COIN_TYPE_SUI } from "./consts";
import { parseWormholeError } from "./errors";
import * as tokenBridgeState from "./tokenBridge/state";
import * as tokenBridgeTransferTokens from "./tokenBridge/transferTokens";
import * as wormholeEmitter from "./wormhole/emitter";
import * as wormholePublishMessage from "./wormhole/publishMessage";

export async function getNewEmitterCapId(
  signer: RawSigner,
  wormholePackage: string,
  wormholeStateId: string
) {
  const owner = await signer.getAddress();

  const tx = new TransactionBlock();
  wormholeEmitter.addNew(tx, wormholePackage, wormholeStateId, owner);

  // Execute and fetch created Emitter cap.
  return signer
    .signAndExecuteTransactionBlock({
      transactionBlock: tx,
      options: {
        showObjectChanges: true,
      },
    })
    .then((result) => {
      const found = result.objectChanges?.filter(
        (item) => "created" === item.type!
      );
      if (found?.length == 1 && "objectId" in found[0]) {
        return found[0].objectId;
      }

      throw new Error("no objects found");
    });
}

export async function testWormholeEmitterNewStatusOrError(
  signer: RawSigner,
  wormholeTestPackage: string,
  wormholeStateId: string
) {
  const tx = new TransactionBlock();
  await signer
    .getAddress()
    .then((owner) =>
      wormholeEmitter.addNew(tx, wormholeTestPackage, wormholeStateId, owner)
    );
  return signer
    .signAndExecuteTransactionBlock({
      transactionBlock: tx,
      options: { showEffects: true },
    })
    .then((result) => result.effects?.status.status)
    .catch((error: Error) => parseWormholeError(error.message));
}

export function addPublishMessageWorkflowTest(
  tx: TransactionBlock,
  wormholeCurrentPackage: string,
  wormholeStateId: string,
  wormholePackageV1: string,
  emitterCapId: string,
  nonce: number,
  payload: Buffer | Uint8Array | number[] | string
) {
  // Prepare message from old build.
  const messageTicket = wormholePublishMessage.addPrepareMessage(
    tx,
    wormholePackageV1,
    emitterCapId,
    nonce,
    payload
  );
  wormholePublishMessage.addPublishMessage(
    tx,
    wormholeCurrentPackage,
    wormholeStateId,
    messageTicket
  );
}

export function addTransferTokensWorkflowTest(
  tx: TransactionBlock,
  tokenBridgeCurrentPackage: string,
  wormholeCurrentPackage: string,
  tokenBridgeStateId: string,
  wormholeStateId: string,
  tokenBridgePackageV1: string,
  suiAmount: bigint | number
) {
  const assetInfo = tokenBridgeState.addVerifiedAsset(
    tx,
    tokenBridgeCurrentPackage,
    COIN_TYPE_SUI,
    tokenBridgeStateId
  );
  const [funded] = tx.splitCoins(tx.gas, [tx.pure(suiAmount)]);

  const recipientChain = 2;
  const recipient = Buffer.alloc(32, "deadbeef", "hex");
  const relayerFee = 0n;
  const nonce = 69;
  const transferTicket = tokenBridgeTransferTokens.addPrepareTransfer(
    tx,
    tokenBridgePackageV1,
    COIN_TYPE_SUI,
    assetInfo,
    funded,
    recipientChain,
    recipient,
    relayerFee,
    nonce
  );
  const messageTicket = tokenBridgeTransferTokens.addTransferTokens(
    tx,
    tokenBridgeCurrentPackage,
    COIN_TYPE_SUI,
    tokenBridgeStateId,
    transferTicket
  );
  wormholePublishMessage.addPublishMessage(
    tx,
    wormholeCurrentPackage,
    wormholeStateId,
    messageTicket
  );
}

export async function testTokenBridgeTransferTokensStatusOrError(
  signer: RawSigner,
  tokenBridgeCurrentPackage: string,
  wormholeCurrentPackage: string,
  tokenBridgeStateId: string,
  wormholeStateId: string,
  tokenBridgePackageV1: string,
  suiAmount: bigint | number
) {
  const tx = new TransactionBlock();

  addTransferTokensWorkflowTest(
    tx,
    tokenBridgeCurrentPackage,
    wormholeCurrentPackage,
    tokenBridgeStateId,
    wormholeStateId,
    tokenBridgePackageV1,
    suiAmount
  );

  return signer
    .signAndExecuteTransactionBlock({
      transactionBlock: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    })
    .then((result) => result.effects?.status.status)
    .catch((error: Error) => parseWormholeError(error.message));
}
