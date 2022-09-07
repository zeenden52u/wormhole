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

export enum Mode {
  listener = "listener",
  executor = "executor",
}

export function envTypeToDirName(envType: EnvType): string {
  return envType.toLowerCase();
}

export async function loadUntypedEnvs(): Promise<{
  common: any;
  listenerOrExecutor: any;
  mode: Mode;
}> {
  const mode = validateStringEnum<Mode>(Mode, process.env.MODE);
  const envType = validateStringEnum<EnvType>(
    EnvType,
    process.env.ENV_TYPE ? process.env.ENV_TYPE : EnvType.MAINNET
  );

  const common = await loadCommon(envType, mode);
  const listenerOrExecutor = loadListenerOrExecutor(envType, mode);
  return {
    common,
    listenerOrExecutor: await listenerOrExecutor,
    mode,
  };
}

async function loadCommon(envType: EnvType, mode: Mode): Promise<any> {
  const obj = await loadFileAndParseToObject(
    `./config/${envTypeToDirName(envType)}/common.yml`
  );
  obj.mode = mode;
  return obj;
}

async function loadListenerOrExecutor(
  envType: EnvType,
  mode: Mode
): Promise<any> {
  return await loadFileAndParseToObject(
    `./config/${envTypeToDirName(envType)}/${mode.toLowerCase()}.yml`
  );
}

// todo: extend to take path w/o extension and look for all supported extensions
async function loadFileAndParseToObject(
  path: string
): Promise<Record<string, any>> {
  const readFile = () => fs.readFile(path, { encoding: "utf-8" });
  const ext = nodePath.extname(path);
  switch (ext) {
    case "json":
      return JSON.parse(await readFile());
    case "yaml":
      return yaml.load(await readFile(), {
        schema: yaml.JSON_SCHEMA,
      }) as Record<string, any>;
    case "yml":
      return yaml.load(await readFile(), {
        schema: yaml.JSON_SCHEMA,
      }) as Record<string, any>;
    default:
      const err = new Error("Config file has unsupported extension") as any;
      err.ext = ext;
      err.path = path;
      throw ext;
  }
}

// async function loadPluginEnvs<T>(
//   envType: EnvType,
//   pluginUris: NodeURI[]
// ): Promise<Record<string, any>[]> {}
