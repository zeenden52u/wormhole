import { TransactionBlock } from "@mysten/sui.js";

export function addNew(
  tx: TransactionBlock,
  wormholePackage: string,
  wormholeStateId: string,
  owner: string
) {
  const [emitterCap] = tx.moveCall({
    target: `${wormholePackage}::emitter::new`,
    arguments: [tx.object(wormholeStateId)],
  });
  tx.transferObjects([emitterCap], tx.pure(owner));
}
