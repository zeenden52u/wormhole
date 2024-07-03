import {
  init,
  getOperatingChains,
  getWormholeRelayer,
  ChainInfo,
} from "../helpers/env";
import { buildOverrides } from "../helpers/deployments";

import { extractChainToBeRegisteredFromRegisterChainVaa } from "../helpers/vaa";

import { inspect } from "util";

interface RegisterChainDescriptor {
  vaa: Buffer;
  chainToRegister: number;
}

const processName = "registerWormholeRelayer";
init();
const chains = getOperatingChains();

const zeroBytes32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * These are the registration VAAs for mainnet.
 */
const base64RegistrationVaas = [
  "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",
  // These are for scroll and blast, note that they are not "full" VAAs, some observations are missing. They just have enough signatures for quorum.
  "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",
];

async function run() {
  console.log(`Start! ${processName}`);

  const registrationVaas = base64RegistrationVaas.map((vaa) => {
    const vaaBuf = Buffer.from(vaa, "base64");
    return {
      vaa: vaaBuf,
      chainToRegister: extractChainToBeRegisteredFromRegisterChainVaa(vaaBuf),
    };
  });
  const tasks = await Promise.allSettled(
    chains.map((chain) => register(chain, registrationVaas)),
  );

  for (const task of tasks) {
    if (task.status === "rejected") {
      console.error(`Register failed: ${inspect(task.reason)}`);
    } else {
      console.log(`Register succeeded for chain ${task.value}`);
    }
  }
}

async function register(
  chain: ChainInfo,
  registrationVaas: RegisterChainDescriptor[],
) {
  console.log(`Registering WormholeRelayers in chain ${chain.chainId}...`);
  const wormholeRelayer = await getWormholeRelayer(chain);

  // TODO: check for already registered VAAs
  for (const { vaa, chainToRegister } of registrationVaas) {
    const registrationAddress =
      await wormholeRelayer.getRegisteredWormholeRelayerContract(
        chainToRegister,
      );
    if (registrationAddress !== zeroBytes32) {
      // We skip chains that are already registered.
      // Note that reregistrations aren't allowed.
      continue;
    }

    const overrides = await buildOverrides(
      () => wormholeRelayer.estimateGas.registerWormholeRelayerContract(vaa),
      chain,
    );
    const tx = await wormholeRelayer.registerWormholeRelayerContract(
      vaa,
      overrides,
    );
    const receipt = await tx.wait();

    if (receipt.status !== 1) {
      throw new Error(
        `Failed registration for chain ${chain.chainId}, tx ${tx.hash}`,
      );
    }
  }

  return chain.chainId;
}

run().then(() => console.log("Done! " + processName));