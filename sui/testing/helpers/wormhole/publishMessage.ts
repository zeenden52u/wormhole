import {
  SUI_CLOCK_OBJECT_ID,
  TransactionArgument,
  TransactionBlock,
} from "@mysten/sui.js";

export function addPrepareMessage(
  tx: TransactionBlock,
  wormholePackage: string,
  emitterCapId: string,
  nonce: number,
  payload: Buffer | Uint8Array | number[] | string
): TransactionArgument {
  const [messageTicket] = tx.moveCall({
    target: `${wormholePackage}::publish_message::prepare_message`,
    arguments: [tx.object(emitterCapId), tx.pure(nonce), tx.pure(payload)],
  });

  return messageTicket;
}

export function addPublishMessage(
  tx: TransactionBlock,
  wormholePackage: string,
  wormholeStateId: string,
  messageTicket: TransactionArgument
) {
  const [feeAmount] = tx.moveCall({
    target: `${wormholePackage}::state::message_fee`,
    arguments: [tx.object(wormholeStateId)],
  });
  const [wormholeFee] = tx.splitCoins(tx.gas, [feeAmount]);
  tx.moveCall({
    target: `${wormholePackage}::publish_message::publish_message`,
    arguments: [
      tx.object(wormholeStateId),
      wormholeFee,
      messageTicket,
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
}
