import { JsonRpcProvider } from "@mysten/sui.js";

export function wormholeModules(wormholePackageId: string): {
  moduleEmitter: `${string}::${string}`;
  moduleGovernanceMessage: `${string}::${string}`;
  modulePackageUtils: `${string}::${string}`;
  modulePublishMessage: `${string}::${string}`;
  moduleUpgradeContract: `${string}::${string}`;
  moduleVaa: `${string}::${string}`;
} {
  return {
    moduleEmitter: `${wormholePackageId}::emitter`,
    moduleGovernanceMessage: `${wormholePackageId}::governance_message`,
    modulePackageUtils: `${wormholePackageId}::package_utils`,
    modulePublishMessage: `${wormholePackageId}::publish_message`,
    moduleUpgradeContract: `${wormholePackageId}::upgrade_contract`,
    moduleVaa: `${wormholePackageId}::vaa`,
  };
}

export function tokenBridgeModules(tokenBridgePackageId: string): {
  moduleRegisterChain: `${string}::${string}`;
  moduleUpgradeContract: `${string}::${string}`;
} {
  return {
    moduleRegisterChain: `${tokenBridgePackageId}::register_chain`,
    moduleUpgradeContract: `${tokenBridgePackageId}::upgrade_contract`,
  };
}

export async function packageV1(provider: JsonRpcProvider, stateId: string) {
  return provider
    .getObject({ id: stateId, options: { showType: true } })
    .then((obj) => obj.data?.type?.split("::")[0]!);
}
