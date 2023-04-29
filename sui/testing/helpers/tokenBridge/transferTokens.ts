import { TransactionArgument, TransactionBlock } from "@mysten/sui.js";

export function addPrepareTransfer(
  tx: TransactionBlock,
  tokenBridgePackage: string,
  coinType: string,
  assetInfo: TransactionArgument,
  funded: TransactionArgument,
  recipientChain: number,
  recipient: Buffer | Uint8Array | number[],
  relayerFee: bigint | number,
  nonce: number
): TransactionArgument {
  const [transferTicket, dust] = tx.moveCall({
    target: `${tokenBridgePackage}::transfer_tokens::prepare_transfer`,
    arguments: [
      assetInfo,
      funded,
      tx.pure(recipientChain),
      tx.pure([...recipient]),
      tx.pure(relayerFee),
      tx.pure(nonce),
    ],
    typeArguments: [coinType],
  });
  tx.moveCall({
    target: `${tokenBridgePackage}::coin_utils::return_nonzero`,
    arguments: [dust],
    typeArguments: [coinType],
  });

  return transferTicket;
}

export function addTransferTokens(
  tx: TransactionBlock,
  tokenBridgePackage: string,
  coinType: string,
  tokenBridgeStateId: string,
  transferTicket: TransactionArgument
): TransactionArgument {
  const [messageTicket] = tx.moveCall({
    target: `${tokenBridgePackage}::transfer_tokens::transfer_tokens`,
    arguments: [tx.object(tokenBridgeStateId), transferTicket],
    typeArguments: [coinType],
  });

  return messageTicket;
}
