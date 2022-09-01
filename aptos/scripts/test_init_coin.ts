import { AptosAccount, TxnBuilderTypes, BCS, HexString, MaybeHexString, AptosClient, FaucetClient, AptosAccountObject } from "aptos";
import {aptosAccountObject1, aptosAccountObject2} from "./constants";
import sha3 from 'js-sha3';
import { TypeTag } from "aptos/dist/transaction_builder/aptos_types";
export const NODE_URL = "http://0.0.0.0:8080/v1";
export const FAUCET_URL = "http://localhost:8081";

const {
    AccountAddress,
    TypeTagStruct,
    EntryFunction,
    StructTag,
    TransactionPayloadEntryFunction,
    RawTransaction,
    ChainId,
  } = TxnBuilderTypes;

const client = new AptosClient(NODE_URL);

const mycoin = new TypeTagStruct(StructTag.fromString("0xc9977c5d1c359042b0c5fb16818d79ed000a58781dab41f83c74f26da2ed6a50::coin::T"));

async function test_init_coin(contractAddress: HexString, accountFrom: AptosAccount): Promise<string> {
    const scriptFunctionPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
      TxnBuilderTypes.EntryFunction.natural(
        `${contractAddress.toString()}::test_init_coin`,
        "test_init_coin",
        [mycoin],
        []
      ),
    );
    const [{ sequence_number: sequenceNumber }, chainId] = await Promise.all([
      client.getAccount(accountFrom.address()),
      client.getChainId(),
    ]);
    const rawTxn = new TxnBuilderTypes.RawTransaction(
      TxnBuilderTypes.AccountAddress.fromHex(accountFrom.address()),
      BigInt(sequenceNumber),
      scriptFunctionPayload,
      BigInt(5000), //max gas to be used
      BigInt(1), //price per unit gas
      BigInt(Math.floor(Date.now() / 1000) + 10),
      new TxnBuilderTypes.ChainId(chainId),
    );

    // const sim = await client.simulateTransaction(accountFrom, rawTxn);
    // sim.forEach((tx) => {
    //   if (!tx.success) {
    //     console.error(JSON.stringify(tx, null, 2));
    //     throw new Error(`Transaction failed: ${tx.vm_status}`);
    //   }
    // });

    const bcsTxn = AptosClient.generateBCSTransaction(accountFrom, rawTxn);
    const transactionRes = await client.submitSignedBCSTransaction(bcsTxn);

    return transactionRes.hash;
  }

async function main(){
    let deployed = AptosAccount.fromAptosAccountObject(aptosAccountObject1);
    let accountFrom = AptosAccount.fromAptosAccountObject(aptosAccountObject2);
    //let accountAddress = accountFrom.address();//new HexString("277fa055b6a73c42c0662d5236c65c864ccbf2d4abd21f174a30c8b786eab84b");
    //const wormholeAddress = new HexString(sha3.sha3_256(Buffer.concat([accountFrom.address().toBuffer(), Buffer.from('wormhole', 'ascii')])));
    let hash = await test_init_coin(deployed.address(), accountFrom);
    console.log("tx hash: ", hash);
}

if (require.main === module) {
    main().then((resp) => console.log(resp));
}
