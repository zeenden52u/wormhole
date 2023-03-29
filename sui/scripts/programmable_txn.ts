import {
    Ed25519Keypair,
    JsonRpcProvider,
    RawSigner,
    TransactionBlock,
    Connection
} from '@mysten/sui.js';
import {execSync} from 'child_process';

const provider = new JsonRpcProvider(new Connection({ fullnode: "http://0.0.0.0:9000" }))

// Put your own private key in here.
const getSigner = (): RawSigner => {
  //public key for private key below is: 0x9f79d84367a618ec4b08e18a2d0e00e84d2803dcf3666a41980e5ffbc8fa2f19
  let privateKey = "AGaHKxUbTCiITbHGDOxpsNmKVUfHgflH7OIoYagYYLqa";
  const bytes = new Uint8Array(Buffer.from(privateKey, "base64"));
  const keypair = Ed25519Keypair.fromSecretKey(bytes.slice(1));
  console.log("pubkey: ", keypair.getPublicKey().toSuiAddress());
  return new RawSigner(keypair, provider);
};

async function splitCoinsAndSend(){
  const signer = getSigner();
  const tx = new TransactionBlock();
  // Split a coin object off of the gas object:
  const [coin] = tx.splitCoins(tx.gas, [tx.pure(100)]);
  // Transfer the resulting coin object to account address
  let account_addr = "0x756c559cb861c20dbe9d20595a400283feffd7c88c78cf34ec075d227e66e3a2";
  tx.transferObjects([coin], tx.pure(account_addr));

  const result = await signer.signAndExecuteTransactionBlock({ transactionBlock: tx });
  console.log({ result });
}

async function moveCall(){
  const signer = getSigner();
  const tx = new TransactionBlock();
  tx.setGasBudget(20000);
  const [w] = tx.moveCall({ target: "0x58cb33db34c9e0de1767d9eb2f547684f38260ed454f3c4a67073e431576496f::programmable::produce_A" });
  const result = await signer.signAndExecuteTransactionBlock({ transactionBlock: tx,  });
  console.log(result);
  console.log(w)
}

/// Example of using programmable transactions to chain move calls.
async function chainMoveCalls() {
  const signer = getSigner();
  const tx = new TransactionBlock();
  tx.setGasBudget(20000);
  let package_id = "0x620790ee4770b2cb6dc427dfe94f8162d480808715c83e5f853d4d52ff7c11d5";
  // counter in state keeps track of how many functions were called
  let state_object_id = "0x2861a05b938c68d90312623bca7a23d57a272ea25cbea7b34b67f139f26e649b";

  // "produce_A" takes nothing as input and produces an object of type A
  const [A] = tx.moveCall({ target: `${package_id}::state::produce_A`, arguments: [tx.object(state_object_id)] });

  // "consume_A_produce_B" takes an object of type A as input and produces an object of type B as output
  const [B] = tx.moveCall({ target: `${package_id}::state::consume_A_produce_B`, arguments: [A, tx.object(state_object_id)] });

  // "consume_B_produce_int" consumes an object of type B and yields an integer
  const [i] = tx.moveCall({ target: `${package_id}::state::consume_B_produce_int`, arguments: [B, tx.object(state_object_id)] });

  const result = await signer.signAndExecuteTransactionBlock({ transactionBlock: tx,  });

  console.log("Updated state object \n", execSync(`sui client object ${state_object_id}`, {encoding: 'utf-8'}));
}

await chainMoveCalls();
