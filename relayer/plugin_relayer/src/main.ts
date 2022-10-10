/*
1 Load config files onto process environment
2 Init Logging
3 Create The Common Environment
4 Init Plugins
5 Branch, based on Listen or Execute

Listen Path
-Init Listener

Execute
-Init Executor
*/

import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";
import * as executorHarness from "./executor/executorHarness";
import { getLogger } from "./helpers/logHelper";
import * as listenerHarness from "./listener/listenerHarness";
import { loadPlugins } from "./loadPlugins";
import { CommonEnv, getCommonEnv } from "./config";
import { loadAndValidateConfig } from "./config";
import { Mode } from "./config/loadConfig";
import { createStorage } from "./storage/storage";
import { InMemoryStore } from "./storage/inMemoryStore";

setDefaultWasm("node");

// instantiate common environment

async function main() {
  await loadAndValidateConfig();
  const commonEnv = getCommonEnv();
  const logger = getLogger();
  const plugins = await loadPlugins(commonEnv);
  const storage = await createStorage(new InMemoryStore(), plugins);

  launchReadinessPortTask(commonEnv);
  // todo: init prometheus

  switch (commonEnv.mode) {
    case Mode.LISTENER:
      logger.info("Running in listener mode");
      await listenerHarness.run(plugins, storage);
      return;
    case Mode.EXECUTOR:
      logger.info("Running in executor mode");
      await executorHarness.run(plugins, storage);
      return;
    case Mode.BOTH:
      logger.info("Running as both executor and listener");
      await Promise.all([
        executorHarness.run(plugins, storage),
        listenerHarness.run(plugins, storage),
      ]);
      return
    default:
      throw new Error(
        "Expected MODE env var to be listener or executor, instead got: " +
          process.env.MODE
      );
  }
}

async function launchReadinessPortTask(commonEnv: CommonEnv) {
  if (!commonEnv.readinessPort) {
    getLogger().warn(
      "Readiness port not defined, not starting readiness server"
    );
    return;
  }
  const Net = await import("net");
  const readinessServer = new Net.Server();
  readinessServer.listen(commonEnv.readinessPort, function () {
    getLogger().info(
      "listening for readiness requests on port " + commonEnv.readinessPort
    );
  });

  readinessServer.on("connection", function (socket: any) {
    //logger.debug("readiness connection");
  });
}

main().catch(e => {
  console.error("Fatal Error");
  console.error(e);
  process.exit(1);
});
