import {
  Connection,
  Ed25519Keypair,
  JsonRpcProvider,
  RawSigner,
} from "@mysten/sui.js";

export function makeWallet(
  connection: Connection,
  privateKey: string
): RawSigner {
  const provider = new JsonRpcProvider(connection);
  const keypair = Ed25519Keypair.fromSecretKey(
    Buffer.from(privateKey, "base64").subarray(1)
  );

  return new RawSigner(keypair, provider);
}
