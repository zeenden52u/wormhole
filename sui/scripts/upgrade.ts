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

async function upgradeContract(){
    const signer = getSigner();
    const tx = new TransactionBlock();
    tx.setGasBudget(20000);
    let upgrade_cap_object_id = "0x1234";
    let upgrade_policy = 0; // Compatible upgrades allowed.
    // (Immutable) SHA256 digest of the bytecode and transitive
    // dependencies that will be used in the upgrade.
    let digest = 0x00;
    const [upgrade_ticket] = tx.moveCall({ target: "0x1::package::authorize_upgrade", arguments:[tx.object(upgrade_cap_object_id), tx.pure(upgrade_policy), tx.pure(digest)]});
    const [w] = tx.moveCall({ target: "0x1::package::produce_A" });

    const result = await signer.signAndExecuteTransactionBlock({ transactionBlock: tx,  });
    console.log(result);
    console.log(w)
}

