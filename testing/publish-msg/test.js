// This test is intended to be run on devnet without an active eth miner
// see https://github.com/trufflesuite/ganache-cli-archive#custom-methods

const {
  NodeHttpTransport,
} = require("@improbable-eng/grpc-web-node-http-transport");
const { ethers } = require("ethers");
const {
  CHAIN_ID_ETH,
  getEmitterAddressEth,
  parseSequenceFromLogEth,
  getSignedVAA,
} = require("@certusone/wormhole-sdk");

const ETH_NODE_URL = "ws://localhost:8545";
const ETH_PRIVATE_KEY =
  "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
const ETH_CORE_BRIDGE = "0xC89Ce4735882C9F0f0FE26686c53074E09B0D550";

(async () => {
  // create a signer for Eth
  const provider = new ethers.providers.WebSocketProvider(ETH_NODE_URL);
  const signer = new ethers.Wallet(ETH_PRIVATE_KEY, provider);

  const core = new ethers.Contract(
    ETH_CORE_BRIDGE,
    [
      `function publishMessageRetHash(uint32 nonce, bytes memory payload, uint8 consistencyLevel) external payable returns (bytes32 vmHash)`,
    ],
    signer
  );

  const nonce = Buffer.alloc(4);
  nonce.writeUInt32LE(123, 0);

  const tx = await core.publishMessageRetHash(
    nonce,
    Buffer.from("abc123", "hex"),
    200
  );

  const receipt = await tx.wait();

  console.log(receipt);

  const seq = parseSequenceFromLogEth(receipt, ETH_CORE_BRIDGE);

  console.log(seq);

  const { vaaBytes: signedVAA } = await getSignedVAA(
    WORMHOLE_RPC_HOST,
    CHAIN_ID_ETH,
    getEmitterAddressEth(signer.address),
    sequence,
    {
      transport: NodeHttpTransport(),
    }
  );

  console.log(Buffer.from(signedVAA).toString("hex"));

  provider.destroy();
})();
