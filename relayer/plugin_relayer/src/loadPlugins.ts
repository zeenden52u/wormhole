import { PluginFactory, Plugin } from "plugin_interface";
import { loadPluginConfig } from "./config/loadConfig";
import { dbg, getLogger } from "./helpers/logHelper";
import { CommonEnv } from "./config";

/*
  1. read plugin URIs from common config
  For Each
    a. dynamically load plugin
    b. look for plugin overrides in common config
    c. construct plugin 
 */
export async function loadPlugins(commonEnv: CommonEnv): Promise<Plugin[]> {
  const logger = getLogger();
  logger.info("Loading plugins...");
  const plugins = await Promise.all(
    commonEnv.pluginURIs.map(uri => loadPlugin(uri, commonEnv))
  );
  logger.info(`Loaded ${plugins.length} plugins`);
  return plugins;
}

export async function loadPlugin(
  uri: string,
  commonEnv: CommonEnv
): Promise<Plugin> {
  const module = (await import(uri)).default as PluginFactory;
  const pluginEnv = await loadPluginConfig(
    module.pluginName,
    uri,
    commonEnv.envType
  );
  return module.create(commonEnv, pluginEnv);
}

/* uncomment and run with ts-node loadPlugins.ts to test separately */

// loadPlugins({
//   plugins: [{ uri: "dummy_plugin", overrides: {key: "val"} }],
//   logLevel: "",
//   promPort: 0,
//   redisHost: "",
//   redisPort: 0,
//   envType: "",
// }).then((e) => {
//   console.error(e);
//   process.exit(1);
// });
