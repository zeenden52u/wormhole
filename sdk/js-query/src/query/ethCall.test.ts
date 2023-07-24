import { describe, expect, jest, test } from "@jest/globals";
import Web3, { ETH_DATA_FORMAT } from "web3";
import axios from "axios";
import * as elliptic from "elliptic";
import {
  EthCallData,
  EthCallQueryRequest,
  PerChainQueryRequest,
  QueryRequest,
  QueryResponse,
  sign,
} from "..";

jest.setTimeout(60000);

// export const ETH_NODE_URL = ci ? "ws://eth-devnet:8545" : "ws://localhost:8545";
const web3 = new Web3("ws://localhost:8545");

const QUERY_SERVER_URL = "http://localhost:6069/v1/query";
const PRIVATE_KEY =
  "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";

function createTestEthCallData(
  to: string,
  name: string,
  outputType: string
): EthCallData {
  return {
    to,
    data: web3.eth.abi.encodeFunctionCall(
      {
        constant: true,
        inputs: [],
        name,
        outputs: [{ name: "", type: outputType }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      []
    ),
  };
}

describe("eth call", () => {
  test.skip("serialize request", () => {
    const nameCallData = createTestEthCallData(
      "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
      "name",
      "string"
    );
    const totalSupplyCallData = createTestEthCallData(
      "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
      "totalSupply",
      "uint256"
    );
    const ethCall = new EthCallQueryRequest("0x28d9630", [
      nameCallData,
      totalSupplyCallData,
    ]);
    const chainId = 5;
    const ethQuery = new PerChainQueryRequest(chainId, ethCall);
    const nonce = 1;
    const request = new QueryRequest(nonce, [ethQuery]);
    const serialized = request.serialize();
    expect(Buffer.from(serialized).toString("hex")).toEqual(
      "000000010100050100000009307832386439363330020d500b1d8e8ef31e21c99d1db9a6444d3adf12700000000406fdde030d500b1d8e8ef31e21c99d1db9a6444d3adf12700000000418160ddd"
    );
  });
  test("parse response", async () => {
    const nameCallData = createTestEthCallData(
      "0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E",
      "name",
      "string"
    );
    const totalSupplyCallData = createTestEthCallData(
      "0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E",
      "totalSupply",
      "uint256"
    );
    const blockNumber = await web3.eth.getBlockNumber(ETH_DATA_FORMAT);
    const ethCall = new EthCallQueryRequest(blockNumber, [
      nameCallData,
      totalSupplyCallData,
    ]);
    const chainId = 2;
    const ethQuery = new PerChainQueryRequest(chainId, ethCall);
    const nonce = 1;
    const request = new QueryRequest(nonce, [ethQuery]);
    const serialized = request.serialize();
    const digest = QueryRequest.digest("DEVNET", serialized);
    const signature = sign(PRIVATE_KEY, digest);
    const response = await axios.put(QUERY_SERVER_URL, {
      signature,
      bytes: Buffer.from(serialized).toString("hex"),
    });
    expect(response.status).toBe(200);

    QueryResponse.fromBytes(Buffer.from(response.data.bytes, "hex"));

    // TODO: verify signatures

    // TOOD: verify query response
  });
});
