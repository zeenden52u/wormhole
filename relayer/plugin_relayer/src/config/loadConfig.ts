/*
 * Loads config files and env vars, resolves them into untyped objects
 */
// const configFile: string = process.env.SPY_RELAY_CONFIG
//   ? process.env.SPY_RELAY_CONFIG
//   : ".env.sample";
// console.log("loading config file [%s]", configFile);
// config({ path: configFile });
// export {};

import * as yaml from "js-yaml";
import * as fs from "fs/promises";
import * as nodePath from "path";
import { validateStringEnum } from "./validateConfig";
import { EnvTypes as EnvType } from "plugin_interface";
import { NodeURI } from ".";

export enum Mode {
  LISTENER = "LISTENER",
  EXECUTOR = "EXECUTOR",
  BOTH = "BOTH",
}

export function envTypeToPath(envType: EnvType): string {
  return envType.toLowerCase();
}

export async function loadUntypedEnvs(): Promise<{
  mode: Mode;
  rawCommonEnv: any;
  rawListenerEnv: any;
  rawExecutorEnv: any;
}> {
  const modeString = process.env.MODE && process.env.MODE.toUpperCase();
  const envTypeString =
    process.env.ENV_TYPE && process.env.ENV_TYPE.toUpperCase();

  const mode = validateStringEnum<Mode>(Mode, modeString);
  const envType = validateStringEnum<EnvType>(
    EnvType,
    envTypeString ? envTypeString : EnvType.MAINNET
  );

  console.log(
    `Starting common config load for env: ${envTypeString}, mode: ${modeString}`
  );

  const rawCommonEnv = await loadCommon(envType, mode);
  rawCommonEnv.envType = envType;
  rawCommonEnv.mode = mode;
  console.log("Successfully loaded the common config file.");

  const rawListenerEnv = await loadListener(envType, mode);
  const rawExecutorEnv = await loadExecutor(envType, mode);
  console.log("Successfully loaded the mode config file.");

  return {
    rawCommonEnv: rawCommonEnv,
    rawListenerEnv,
    rawExecutorEnv,
    mode,
  };
}

async function loadCommon(envType: EnvType, mode: Mode): Promise<any> {
  const obj = await loadFileAndParseToObject(
    `./config/${envTypeToPath(envType)}/common.yml`
  );
  obj.mode = mode;
  return obj;
}

async function loadExecutor(envType: EnvType, mode: Mode): Promise<any> {
  if (mode == Mode.EXECUTOR || mode == Mode.BOTH) {
    return await loadFileAndParseToObject(
      `./config/${envTypeToPath(envType)}/${Mode.EXECUTOR.toLowerCase()}.yml`
    );
  }
  return undefined;
}

async function loadListener(envType: EnvType, mode: Mode): Promise<any> {
  if (mode == Mode.LISTENER || mode == Mode.BOTH) {
    return await loadFileAndParseToObject(
      `./config/${envTypeToPath(envType)}/${Mode.LISTENER.toLowerCase()}.yml`
    );
  }
  return undefined;
}

export async function loadPluginConfig(
  pluginName: string,
  pluginURI: NodeURI,
  envType: EnvType
): Promise<Record<string, any>> {
  const overrides = loadFileAndParseToObject(
    `./config/${envTypeToPath(envType)}/plugins/${pluginName}.yml`
  );
  const defaultConfig = loadFileAndParseToObject(
    `./node_modules/${pluginURI}/config/${envTypeToPath(envType)}.yml`
  );
  return { ...(await defaultConfig), ...(await overrides) };
}

// todo: extend to take path w/o extension and look for all supported extensions
async function loadFileAndParseToObject(
  path: string
): Promise<Record<string, any>> {
  console.log("About to read contents of : " + path);
  const fileContent = await fs.readFile(path, { encoding: "utf-8" });
  console.log("Successfully read file contents");
  const ext = nodePath.extname(path);
  switch (ext) {
    case ".json":
      return JSON.parse(fileContent);
    case ".yaml":
      return yaml.load(fileContent, {
        schema: yaml.JSON_SCHEMA,
      }) as Record<string, any>;
    case ".yml":
      return yaml.load(fileContent, {
        schema: yaml.JSON_SCHEMA,
      }) as Record<string, any>;
    default:
      const err = new Error("Config file has unsupported extension") as any;
      err.ext = ext;
      err.path = path;
      throw err;
  }
}
