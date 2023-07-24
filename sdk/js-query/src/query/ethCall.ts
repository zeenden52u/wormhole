import { BinaryWriter } from "./BinaryWriter";
import { ChainQueryType, ChainSpecificQuery } from "./request";
import { ChainSpecificResponse } from "./response";
import { hexToUint8Array } from "./utils";

export interface EthCallData {
  to: string;
  data: string;
}

export class EthCallQueryRequest implements ChainSpecificQuery {
  constructor(public blockId: string, public callData: EthCallData[]) {}

  type(): ChainQueryType {
    return ChainQueryType.EthCall;
  }

  toBytes(): Uint8Array {
    const writer = new BinaryWriter()
      .writeUint32(this.blockId.length)
      .writeBytes(Buffer.from(this.blockId))
      .writeUint8(this.callData.length);
    this.callData.forEach(({ to, data }) => {
      const dataArray = hexToUint8Array(data);
      writer
        .writeBytes(hexToUint8Array(to))
        .writeUint32(dataArray.length)
        .writeBytes(dataArray);
    });
    return writer.data();
  }
}

export class EthCallQueryResponse implements ChainSpecificResponse {
  constructor(
    public blockNumber: number,
    public hash: string,
    public time: string,
    public results: string[][]
  ) {}

  type(): ChainQueryType {
    return ChainQueryType.EthCall;
  }

  // static fromBytes(bytes: Uint8Array): EthCallQueryResponse {}
}
