import "dotenv/config";
import {
  CHAIN_ID_ACALA,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_APTOS,
  CHAIN_ID_ARBITRUM,
  CHAIN_ID_AURORA,
  CHAIN_ID_AVAX,
  CHAIN_ID_BSC,
  CHAIN_ID_CELO,
  CHAIN_ID_ETH,
  CHAIN_ID_FANTOM,
  CHAIN_ID_INJECTIVE,
  CHAIN_ID_KARURA,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_MOONBEAM,
  CHAIN_ID_NEAR,
  CHAIN_ID_OASIS,
  CHAIN_ID_OPTIMISM,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  CHAIN_ID_TERRA2,
  CHAIN_ID_XPLA,
} from "@certusone/wormhole-sdk/lib/cjs/utils/consts";
import {
  parse,
  Payload,
  serialiseVAA,
  sign,
  VAA,
} from "@certusone/wormhole-sdk/lib/cjs/vaa/generic";
import { open } from "fs/promises";
import ora from "ora";
import { createInterface } from "readline";
import { parseTokenTransferPayload } from "@certusone/wormhole-sdk/lib/cjs/vaa/tokenBridge";
import { parseVaa } from "@certusone/wormhole-sdk/lib/cjs/vaa/wormhole";
import { ZERO_FEE } from "@wormhole-foundation/wormchain-sdk/lib/core/consts";
import {
  getWallet,
  getWormchainSigningClient,
} from "@wormhole-foundation/wormchain-sdk";
import { toUtf8 } from "cosmwasm";

if (!process.env.VAA_CSV) {
  const msg = `VAA_CSV is required`;
  console.error(msg);
  throw msg;
}

const STAGE = Number(process.env.STAGE || "1");
const LOG_FILE =
  process.env.LOG_FILE || `submit-${new Date().toISOString()}.log`;
const ACCOUNTANT_CONTRACT_ADDRESS = process.env.ACCOUNTANT_CONTRACT_ADDRESS;
if (!ACCOUNTANT_CONTRACT_ADDRESS) {
  const msg = "ACCOUNTANT_CONTRACT_ADDRESS must be set";
  console.error(msg);
  throw msg;
}
console.log("Global Accountant Address:", ACCOUNTANT_CONTRACT_ADDRESS);
let DEVNET = false;
let WORMCHAIN_HOST = process.env.WORMCHAIN_HOST;
if (!WORMCHAIN_HOST) {
  console.log("WORMCHAIN_HOST not set, defaulting to devnet");
  WORMCHAIN_HOST = "http://localhost:26659";
  DEVNET = true;
}
console.log("Wormchain Host:", WORMCHAIN_HOST);
let MNEMONIC = process.env.MNEMONIC;
if (!MNEMONIC) {
  console.log("MNEMONIC not set, defaulting to devnet");
  MNEMONIC =
    "notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius";
}

// BEFORE
// ./build/wormchaind start --home build --rpc.laddr="tcp://0.0.0.0:26659" > wormchaind.out 2>&1 &
// npm run deploy-wormchain --prefix contracts/tools/
// paste the "instantiated accounting:" address above

// AFTER
// sudo pkill -f "./build/wormchaind start --home build --rpc.laddr=tcp://0.0.0.0:26659"
// sudo pkill -P $$
// rm wormchaind.out

// Run like NODE_OPTIONS="--max-old-space-size=8096" VAA_CSV="../../../../gs3.csv" npm run test-backfill
// To resume, run with STAGE=? where ? is 1, 2, 3, 4, or 5
// To resume from stage 4+, specify a log file to read with LOG_FILE
// NOTE: the extra blocks are on purpose to allow variables to be cleaned up

// Benchmarks
// using parse
// Stage 1: 1:40
// Stage 2a: 0:30
// Stage 2b: 0:01
// Stage 2c: 0:20 // realized I could have cut this step by keeping the original hex in there
// Stage 3: n/a
// using parseVaa in stage 2
// Stage 2a: 0:20
// Stage 2b: 0:02

/*
 * Goal:
 *   Take an input CSV of VAAs,
 *   filter them to token bridge transfer VAAs,
 *   resign them as the devnet guardian,
 *   order them in such a way to avoid accounting conflicts,
 *   and submit them in the largest batch size for speed
 */

const DEVNET_SIGNER =
  "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";

// copied from sdk/mainnet_consts.go
const knownTokenbridgeEmitters = {
  [CHAIN_ID_SOLANA]:
    "ec7372995d5cc8732397fb0ad35c0121e0eaa90d26f828a534cab54391b3a4f5".toLowerCase(),
  [CHAIN_ID_ETH]:
    "0000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585".toLowerCase(),
  [CHAIN_ID_TERRA]:
    "0000000000000000000000007cf7b764e38a0a5e967972c1df77d432510564e2".toLowerCase(),
  [CHAIN_ID_TERRA2]:
    "a463ad028fb79679cfc8ce1efba35ac0e77b35080a1abe9bebe83461f176b0a3".toLowerCase(),
  [CHAIN_ID_BSC]:
    "000000000000000000000000b6f6d86a8f9879a9c87f643768d9efc38c1da6e7".toLowerCase(),
  [CHAIN_ID_POLYGON]:
    "0000000000000000000000005a58505a96d1dbf8df91cb21b54419fc36e93fde".toLowerCase(),
  [CHAIN_ID_AVAX]:
    "0000000000000000000000000e082f06ff657d94310cb8ce8b0d9a04541d8052".toLowerCase(),
  [CHAIN_ID_OASIS]:
    "0000000000000000000000005848c791e09901b40a9ef749f2a6735b418d7564".toLowerCase(),
  [CHAIN_ID_ALGORAND]:
    "67e93fa6c8ac5c819990aa7340c0c16b508abb1178be9b30d024b8ac25193d45".toLowerCase(),
  [CHAIN_ID_APTOS]:
    "0000000000000000000000000000000000000000000000000000000000000001".toLowerCase(),
  [CHAIN_ID_AURORA]:
    "00000000000000000000000051b5123a7b0F9b2bA265f9c4C8de7D78D52f510F".toLowerCase(),
  [CHAIN_ID_FANTOM]:
    "0000000000000000000000007C9Fc5741288cDFdD83CeB07f3ea7e22618D79D2".toLowerCase(),
  [CHAIN_ID_KARURA]:
    "000000000000000000000000ae9d7fe007b3327AA64A32824Aaac52C42a6E624".toLowerCase(),
  [CHAIN_ID_ACALA]:
    "000000000000000000000000ae9d7fe007b3327AA64A32824Aaac52C42a6E624".toLowerCase(),
  [CHAIN_ID_KLAYTN]:
    "0000000000000000000000005b08ac39EAED75c0439FC750d9FE7E1F9dD0193F".toLowerCase(),
  [CHAIN_ID_CELO]:
    "000000000000000000000000796Dff6D74F3E27060B71255Fe517BFb23C93eed".toLowerCase(),
  [CHAIN_ID_NEAR]:
    "148410499d3fcda4dcfd68a1ebfcdddda16ab28326448d4aae4d2f0465cdfcb7".toLowerCase(),
  [CHAIN_ID_MOONBEAM]:
    "000000000000000000000000B1731c586ca89a23809861c6103F0b96B3F57D92".toLowerCase(),
  [CHAIN_ID_ARBITRUM]:
    "0000000000000000000000000b2402144Bb366A632D14B83F244D2e0e21bD39c".toLowerCase(),
  [CHAIN_ID_OPTIMISM]:
    "0000000000000000000000001D68124e65faFC907325e3EDbF8c4d84499DAa8b".toLowerCase(),
  [CHAIN_ID_XPLA]:
    "8f9cf727175353b17a5f574270e370776123d90fd74956ae4277962b4fdee24c".toLowerCase(),
  [CHAIN_ID_INJECTIVE]:
    "00000000000000000000000045dbea4617971d93188eda21530bc6503d153313".toLowerCase(),
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const MAX_UINT_16 = "65535";
export const padUint16 = (s: string): string =>
  s.padStart(MAX_UINT_16.length, "0");

async function saveVAAsToFile(name: string, arr: string[][]): Promise<void> {
  const logMsg = (processed: number, total: number) =>
    `saving VAAs to ${name}: ${((processed / total) * 100).toFixed(
      2
    )}% ${processed} / ${total}`;
  const log = ora(logMsg(0, arr.length)).start();
  const f = await open(name, "w");
  for (let idx = 0; idx < arr.length; idx++) {
    log.text = logMsg(idx + 1, arr.length);
    await f.writeFile(`${arr[idx].join(",")}\n`);
  }
  await f.close();
  log.succeed();
}

async function loadVAAsFromFile(name: string): Promise<string[][]> {
  const arr: string[][] = [];
  const logMsg = (total: number) => `loading VAAs from ${name}: ${total}`;
  const log = ora(logMsg(0)).start();
  const f = await open(name, "r");
  const stream = f.createReadStream();
  const readline = createInterface({ input: stream });
  for await (const line of readline) {
    arr.push(line.split(","));
    log.text = logMsg(arr.length);
  }
  await f.close();
  log.succeed();
  return arr;
}

function parseFailureRangesFromLogs(
  results: string[][]
): [string, number, number][] {
  const ranges: [string, number, number][] = [];
  for (const [token, start, end, result] of results) {
    if (!result.startsWith("success")) {
      ranges.push([token, Number(start), Number(end) + 1]);
    }
  }
  return ranges;
}

// Bigtable VAA ID format
// chain:emitter:sequence
// 2:00000000000000000000000005b70fb5477a93be33822bfb31fdaf2c171970df:0000000000000000
function makeVaaId(chain: number, emitter: string, sequence: bigint) {
  return `${chain}:${emitter}:${sequence.toString().padStart(16, "0")}`;
}

function parseFailureIDsFromLogs(results: string[][]): string[] {
  const skips: string[] = [];
  for (const [_token, start, end, result] of results) {
    const m = result.match("failed to commit transfer for key (.*?):");
    if (m) {
      const [chain, emitter, sequence] = m[1].split("/");
      skips.push(makeVaaId(Number(chain), emitter, BigInt(sequence)));
    }
  }
  return skips;
}

function logDateTime() {
  console.log(new Date().toLocaleString());
}

(async () => {
  // STAGE 1
  // filter down to token bridge transfers (with and without payload)
  if (STAGE <= 1) {
    logDateTime();
    const vaas = await loadVAAsFromFile(process.env.VAA_CSV);
    const filtered: string[][] = [];
    const logMsg = (transfers: number, processed: number, total: number) =>
      `filtering token bridge transfer VAAs: ${(
        (processed / total) *
        100
      ).toFixed(
        2
      )}% ${transfers} transfers / ${processed} processed / ${total} total`;
    const log = ora(logMsg(0, 0, vaas.length)).start();

    for (let idx = 0; idx < vaas.length; idx++) {
      const [id, bytes] = vaas[idx];
      const [chain, emitter, sequence] = id.split(":");
      if (knownTokenbridgeEmitters[Number(chain)] === emitter.toLowerCase()) {
        try {
          const vaa = parse(Buffer.from(bytes, "hex"));
          if (
            vaa.payload.type === "Transfer" ||
            vaa.payload.type === "TransferWithPayload"
          ) {
            if (DEVNET) {
              vaa.guardianSetIndex = 0;
              vaa.signatures = sign([DEVNET_SIGNER], vaa as VAA<Payload>);
              filtered.push([id, serialiseVAA(vaa as VAA<Payload>)]);
            } else {
              filtered.push([id, bytes]);
            }
          }
        } catch (e) {
          // TODO: dump errors to a log
          console.error("error parsing", id);
        }
      }
      log.text = logMsg(filtered.length, idx + 1, vaas.length);
      await sleep(0); // let the text update
    }
    log.succeed();
    logDateTime();
    await saveVAAsToFile("filtered.csv", filtered);
    logDateTime();
  }

  // STAGE 2
  // sort transfers by origin token then timestamp
  if (STAGE <= 2) {
    // yeah, any because I didn't feel like converting the number back and forth
    const sorted: any[][] = await loadVAAsFromFile("filtered.csv");
    {
      // parse hex into VAAs
      logDateTime();
      // parse takes a while, so convert them all first
      const logMsg = (n: number) =>
        `converting ${((n / sorted.length) * 100).toFixed(2)}% ${n}/${
          sorted.length
        }`;
      const log = ora(logMsg(0)).start();
      for (let idx = 0; idx < sorted.length; idx++) {
        const [id, hex] = sorted[idx];
        const vaa = parseVaa(Buffer.from(hex, "hex"));
        const { tokenChain, tokenAddress } = parseTokenTransferPayload(
          vaa.payload
        );
        sorted[idx] = [
          id,
          `${padUint16(tokenChain.toString())}-${tokenAddress.toString("hex")}`,
          vaa.timestamp,
          hex,
        ];
        log.text = logMsg(idx + 1);
        await sleep(0); // let the text update
      }
      log.succeed();
      logDateTime();
    }
    {
      // sort
      logDateTime();
      const log = ora("sorting").start();
      sorted.sort(([_aId, aToken, aTimestamp], [_bId, bToken, bTimestamp]) => {
        if (aToken < bToken) {
          return -1;
        } else if (bToken < aToken) {
          return 1;
        } else {
          if (aTimestamp < bTimestamp) {
            return -1;
          }
          if (bTimestamp < aTimestamp) {
            return 1;
          }
        }
        return 0;
      });
      log.succeed();
      logDateTime();
      await saveVAAsToFile("sorted.csv", sorted);
      logDateTime();
    }
  }

  // STAGE 3
  if (STAGE <= 3) {
    let total = 0;
    logDateTime();
    const vaasByToken: { [token: string]: string[][] } = {};
    {
      const sorted = await loadVAAsFromFile("sorted.csv");
      total = sorted.length;
      for (const item of sorted) {
        const [_, token] = item;
        if (!vaasByToken[token]) {
          vaasByToken[token] = [];
        }
        vaasByToken[token].push(item);
      }
    }
    logDateTime();
    const tokens = Object.keys(vaasByToken);
    const wallet = await getWallet(MNEMONIC);
    const client = await getWormchainSigningClient(WORMCHAIN_HOST, wallet);
    const signers = await wallet.getAccounts();
    const signer = signers[0].address;
    let txMsg = (current: number) =>
      `submitting transfers: ${((current / total) * 100).toFixed(
        2
      )}% ${current} / ${total}  `;
    const log = ora(txMsg(0)).start();
    const logOut = await open(LOG_FILE, "w");
    let current = 0;
    for (let tokenIdx = 0; tokenIdx < tokens.length; tokenIdx++) {
      const token = tokens[tokenIdx];
      const vaas = vaasByToken[token];
      // some of these have long payloads :cry:
      // 2000 is too large
      const batchSize =
        token ===
        "00002-000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
          ? DEVNET
            ? 500
            : 50
          : DEVNET
          ? 1000
          : 100;
      for (let vaaIdx = 0; vaaIdx < vaas.length; vaaIdx += batchSize) {
        const batch = vaas.slice(vaaIdx, vaaIdx + batchSize);
        log.text = txMsg(current);
        await logOut.write(`${token},${vaaIdx},${vaaIdx + batch.length - 1},`);
        try {
          const msg = client.wasm.msgExecuteContract({
            sender: signer,
            contract: ACCOUNTANT_CONTRACT_ADDRESS,
            msg: toUtf8(
              JSON.stringify({
                submit_vaas: {
                  vaas: batch.map(([_id, _token, _timestamp, hex]) =>
                    Buffer.from(hex, "hex").toString("base64")
                  ),
                },
              })
            ),
            funds: [],
          });
          const res = await client.signAndBroadcast(signer, [msg], {
            ...ZERO_FEE,
            gas: "100000000",
          });
          if (res.code !== 0) {
            await logOut.write(`${res.rawLog}\n`);
          } else {
            await logOut.write(`success ${res.transactionHash}\n`);
          }
        } catch (e) {
          await logOut.write(`${e?.message ? e.message : "unknown error"}\n`);
        }
        current += batch.length;
      }
    }
    log.succeed();
    await logOut.close();
    logDateTime();
  }

  // STAGE 4
  if (STAGE <= 4) {
    const results = await loadVAAsFromFile(LOG_FILE);
    let msgSuccesses = 0;
    let txSuccesses = 0;
    let msgFailures = 0;
    let txFailures = 0;
    let mgsTotal = 0;
    let txTotal = 0;
    for (const [_token, start, end, result] of results) {
      const count = Number(end) - Number(start) + 1;
      mgsTotal += count;
      txTotal += 1;
      if (result.startsWith("success")) {
        msgSuccesses += count;
        txSuccesses += 1;
      } else {
        msgFailures += count;
        txFailures += 1;
      }
    }
    console.log("\nMessages");
    console.log(`total: ${mgsTotal}`);
    console.log(
      `successes: ${((msgSuccesses / mgsTotal) * 100).toFixed(
        2
      )}% ${msgSuccesses}`
    );
    console.log(
      `failures: ${((msgFailures / mgsTotal) * 100).toFixed(2)}% ${msgFailures}`
    );
    console.log("\nTransactions");
    console.log(`total: ${txTotal}`);
    console.log(
      `successes: ${((txSuccesses / txTotal) * 100).toFixed(2)}% ${txSuccesses}`
    );
    console.log(
      `failures: ${((txFailures / txTotal) * 100).toFixed(2)}% ${txFailures}`
    );
  }

  let skips = [];
  // STAGE 5
  if (STAGE <= 5) {
    // TODO: reduce copy pasta from stage 3
    logDateTime();
    const vaasByToken: { [token: string]: string[][] } = {};
    {
      const sorted = await loadVAAsFromFile("sorted.csv");
      for (const item of sorted) {
        const [_, token] = item;
        if (!vaasByToken[token]) {
          vaasByToken[token] = [];
        }
        vaasByToken[token].push(item);
      }
    }
    logDateTime();
    const wallet = await getWallet(MNEMONIC);
    const client = await getWormchainSigningClient(WORMCHAIN_HOST, wallet);
    const signers = await wallet.getAccounts();
    const signer = signers[0].address;

    let lastLog = LOG_FILE;
    let round = 2;
    while (round <= 1000) {
      logDateTime();
      const results = await loadVAAsFromFile(lastLog);
      const ranges = parseFailureRangesFromLogs(results);
      const total = ranges.reduce(
        (prev, curr) => prev + (curr[2] - curr[1]),
        0
      );
      skips = [...skips, ...parseFailureIDsFromLogs(results)];
      const skipFile = `skip-round-${round}-${new Date().toISOString()}.log`;
      const skipOut = await open(skipFile, "w");
      await skipOut.write(JSON.stringify(skips, undefined, 2));
      await skipOut.close();
      const logFile = `submit-round-${round}-${new Date().toISOString()}.log`;
      let txMsg = (current: number) =>
        `submitting transfers: ${((current / total) * 100).toFixed(
          2
        )}% ${current} / ${total}  `;

      // TODO: reduce copy pasta from stage 3
      const log = ora(txMsg(0)).start();
      const logOut = await open(logFile, "w");
      let current = 0;
      for (const [token, start, end] of ranges) {
        const vaas = vaasByToken[token];
        // some of these have long payloads :cry:
        // 2000 is too large
        const batchSize =
          token ===
          "00002-000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
            ? DEVNET
              ? 500
              : 50
            : DEVNET
            ? 1000
            : 100;
        for (let vaaIdx = start; vaaIdx < end; vaaIdx += batchSize) {
          const batch = vaas.slice(vaaIdx, vaaIdx + batchSize);
          log.text = txMsg(current);
          await logOut.write(
            `${token},${vaaIdx},${vaaIdx + batch.length - 1},`
          );
          try {
            const msg = client.wasm.msgExecuteContract({
              sender: signer,
              contract: ACCOUNTANT_CONTRACT_ADDRESS,
              msg: toUtf8(
                JSON.stringify({
                  submit_vaas: {
                    vaas: batch
                      .filter(([id]) => !skips.includes(id))
                      .map(([_id, _token, _timestamp, hex]) =>
                        Buffer.from(hex, "hex").toString("base64")
                      ),
                  },
                })
              ),
              funds: [],
            });
            const res = await client.signAndBroadcast(signer, [msg], {
              ...ZERO_FEE,
              gas: "100000000",
            });
            if (res.code !== 0) {
              await logOut.write(`${res.rawLog}\n`);
            } else {
              await logOut.write(`success ${res.transactionHash}\n`);
            }
          } catch (e) {
            await logOut.write(`${e?.message ? e.message : "unknown error"}\n`);
          }
          current += batch.length;
        }
      }
      log.succeed();
      await logOut.close();
      logDateTime();

      lastLog = logFile;
      round++;
    }
    logDateTime();
  }

  // STAGE 6
  if (STAGE <= 6) {
    // TODO: not really a stage?
    // TODO: reduce copy pasta from stage 3
    logDateTime();
    // TODO: get dynamically?
    // const skips = require("./skip-round-1000-2023-02-07T02:32:07.524Z.log")
    // lookup speed improvement
    const skipMap = skips.reduce((p, c) => {
      p[c] = true;
      return p;
    }, {} as { [id: string]: boolean });
    const vaas: string[][] = [];
    {
      const sorted = await loadVAAsFromFile("sorted.csv");
      for (const item of sorted) {
        const [id] = item;
        if (skipMap[id]) {
          vaas.push(item);
        }
      }
    }
    logDateTime();
    const wallet = await getWallet(MNEMONIC);
    const client = await getWormchainSigningClient(WORMCHAIN_HOST, wallet);
    const signers = await wallet.getAccounts();
    const signer = signers[0].address;
    const successes: string[] = [];
    let round = 1;
    while (round <= 100) {
      logDateTime();
      const toSubmit = vaas.filter(([id]) => !successes.includes(id));
      const logFile = `submit-skipped-${round}-${new Date().toISOString()}.log`;
      let txMsg = (current: number, successes: number) =>
        `submitting skipped transfers: ${(
          (current / toSubmit.length) *
          100
        ).toFixed(2)}% ${current} / ${toSubmit.length}, successes ${(
          (successes / vaas.length) *
          100
        ).toFixed(2)}% ${successes} / ${vaas.length}`;

      // TODO: reduce copy pasta from stage 3
      const log = ora(txMsg(0, successes.length)).start();
      const logOut = await open(logFile, "w");
      let current = 0;
      for (const [id, token, _timestamp, hex] of toSubmit) {
        log.text = txMsg(current, successes.length);
        await logOut.write(`${id},${token},`);
        try {
          const msg = client.wasm.msgExecuteContract({
            sender: signer,
            contract: ACCOUNTANT_CONTRACT_ADDRESS,
            msg: toUtf8(
              JSON.stringify({
                submit_vaas: {
                  vaas: [Buffer.from(hex, "hex").toString("base64")],
                },
              })
            ),
            funds: [],
          });
          const res = await client.signAndBroadcast(signer, [msg], {
            ...ZERO_FEE,
            gas: "100000000",
          });
          if (res.code !== 0) {
            await logOut.write(`${res.rawLog}\n`);
          } else {
            successes.push(id);
            await logOut.write(`success ${res.transactionHash}\n`);
          }
        } catch (e) {
          await logOut.write(`${e?.message ? e.message : "unknown error"}\n`);
        }
        current++;
      }
      log.succeed();
      await logOut.close();
      logDateTime();

      round++;
    }
    logDateTime();
  }
})();
