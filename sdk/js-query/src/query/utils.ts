import * as elliptic from "elliptic";

export function isHex(s: string) {
  // TODO: even length?
  return /^(0x)?[0-9a-fA-F]+$/.test(s);
}

// TODO: use from wormhole sdk?
export function hexToUint8Array(s: string): Uint8Array {
  if (!isHex(s)) {
    throw new Error(`${s} is not hex`);
  }
  return new Uint8Array(
    Buffer.from(s.startsWith("0x") ? s.slice(2) : s, "hex")
  );
}

/**
 * @param key Private key used to sign `data`
 * @param data Data for signing
 * @returns ECDSA secp256k1 signature
 */
export function sign(key: string, data: Uint8Array): string {
  const ec = new elliptic.ec("secp256k1");
  const keyPair = ec.keyFromPrivate(key);
  const signature = keyPair.sign(data, { canonical: true });
  const packed =
    signature.r.toString("hex").padStart(64, "0") +
    signature.s.toString("hex").padStart(64, "0") +
    Buffer.from([signature.recoveryParam ?? 0]).toString("hex");
  return packed;
}
