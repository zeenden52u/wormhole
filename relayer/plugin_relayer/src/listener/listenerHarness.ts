/*
1. Grab Logger & Common Env
2. Instantiate Listener Env
3. Instantiate Redis Connection
4. Optionally Instantiate Spy Connection
5. Optionally Instantiate REST Connection
6.  
*/

import { getCommonEnvironment, getListenerEnvironment } from "../configureEnv";
import { getLogger, getScopedLogger } from "../helpers/logHelper";
import * as redisHelper from "../helpers/redisHelper";
import { ContractFilter, Plugin } from "plugin_interface";
import {
  createSpyRPCServiceClient,
  subscribeSignedVAA,
} from "@certusone/wormhole-spydk";
import { sleep } from "../helpers/utils";
import { SpyRPCServiceClient } from "@certusone/wormhole-spydk/lib/cjs/proto/spy/v1/spy";
import { PluginStorage, Storage } from "../helpers/storage";

const logger = getScopedLogger(["listenerHarness"], getLogger());
const commonEnv = getCommonEnvironment();

export async function run(plugins: Plugin[], storage: Storage) {
  const listnerEnv = getListenerEnvironment();

  //if spy is enabled, instantiate spy with filters
  if (shouldSpy(plugins)) {
    const spyClient = createSpyRPCServiceClient(
      listnerEnv.spyServiceHost || ""
    );
    plugins.forEach((plugin) => {
      if (plugin.shouldSpy) {
        runPluginSpyListener(storage.getPluginStorage(plugin), spyClient);
      }
    });
  }

  //if rest is enabled, instantiate rest with filters
  if (shouldRest(plugins)) {
    //const restListener = setupRestListener(restFilters);
  }
}

function shouldRest(plugins: Plugin[]): boolean {
  return plugins.some((x) => x.shouldRest);
}

function shouldSpy(plugins: Plugin[]): boolean {
  return plugins.some((x) => x.shouldSpy);
}

// 1. fetches scratch area and list of actions
// 2. calls plugin.consumeEvent(..)
// 3. applies ActionUpdate produced by plugin
async function consumeEventHarness(
  vaa: Buffer,
  storage: PluginStorage
): Promise<void> {
  try {
    const stagingArea = await storage.getStagingArea();
    const { actions, nextStagingArea } = await storage.plugin.consumeEvent(
      vaa,
      stagingArea
    );
    await storage.addActions(actions);
    await storage.saveStagingArea(nextStagingArea);
  } catch (e) {
    logger.error(e);
    // metric onError
  }
}

//used for both rest & spy relayer for now
async function runPluginSpyListener(
  pluginStorage: PluginStorage,
  client: SpyRPCServiceClient
) {
  const plugin = pluginStorage.plugin;
  while (true) {
    let stream: any;
    try {
      stream = await subscribeSignedVAA(client, {
        filters: plugin.getFilters().map((x) => {
          return {
            emitterFilter: x,
          };
        }),
      });

      //TODO add staging area for event consume
      stream.on("data", (vaa: Buffer) =>
        consumeEventHarness(vaa, pluginStorage)
      );

      let connected = true;
      stream.on("error", (err: any) => {
        logger.error("spy service returned an error: %o", err);
        connected = false;
      });

      stream.on("close", () => {
        logger.error("spy service closed the connection!");
        connected = false;
      });

      logger.info(
        "connected to spy service, listening for transfer signed VAAs"
      );

      while (connected) {
        await sleep(1000);
      }
    } catch (e) {
      logger.error("spy service threw an exception: %o", e);
    }

    stream.destroy();
    await sleep(5 * 1000);
    logger.info("attempting to reconnect to the spy service");
  }
}
