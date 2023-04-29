import { TransactionArgument, TransactionBlock } from "@mysten/sui.js";

export function addVerifiedAsset(
  tx: TransactionBlock,
  tokenBridgePackage: string,
  coinType: string,
  tokenBridgeStateId: string
): TransactionArgument {
  const [assetInfo] = tx.moveCall({
    target: `${tokenBridgePackage}::state::verified_asset`,
    arguments: [tx.object(tokenBridgeStateId)],
    typeArguments: [coinType],
  });

  return assetInfo;
}
