import { ChainQueryType } from "./request";

export class QueryResponse {
  signatures: string[] = [];
  bytes: string = "";

  //   constructor(signatures: string[], bytes: string) {

  //   }

  static fromBytes(bytes: Uint8Array) {
    //const reader: Reader = {
    //  buffer: Buffer.from(bytes),
    //  i: 0,
    //};
    //// Request
    //const requestChain = reader.buffer.readUint16BE(reader.i);
    //reader.i += 2;
    //const signature = buffer.toString("hex", offset, offset + 65);
    //offset += 65;
    //const request = null;
    //// Response
    //const numPerChainResponses = buffer.readUint8(offset);
  }
}

export class PerChainQueryResponse {
  constructor(public chainId: number, public response: ChainSpecificResponse) {}
}

export interface ChainSpecificResponse {
  type(): ChainQueryType;
  // serialize(): Uint8Array;
}
