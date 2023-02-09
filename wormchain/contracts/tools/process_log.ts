import { open } from "fs/promises";
import ora from "ora";
import { createInterface } from "readline";

const LOG_FILE = process.env.LOG_FILE;
if (!LOG_FILE) {
  throw new Error("Must specify LOG_FILE");
}

async function loadResultsFromFile(name: string): Promise<string[][]> {
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

(async () => {
  const results = await loadResultsFromFile(LOG_FILE);
  let msgSuccesses = 0;
  let txSuccesses = 0;
  let msgFailures = 0;
  let txFailures = 0;
  let mgsTotal = 0;
  let txTotal = 0;
  for (const [token, start, end, result] of results) {
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
  console.log("Messages");
  console.log(`total: ${mgsTotal}`);
  console.log(
    `successes: ${((msgSuccesses / mgsTotal) * 100).toFixed(
      2
    )}% ${msgSuccesses}`
  );
  console.log(
    `failures: ${((msgFailures / mgsTotal) * 100).toFixed(2)}% ${msgFailures}`
  );
  console.log("Transactions");
  console.log(`total: ${txTotal}`);
  console.log(
    `successes: ${((txSuccesses / txTotal) * 100).toFixed(2)}% ${txSuccesses}`
  );
  console.log(
    `failures: ${((txFailures / txTotal) * 100).toFixed(2)}% ${txFailures}`
  );
})();
