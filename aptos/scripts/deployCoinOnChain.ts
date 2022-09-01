import { AptosAccount, TxnBuilderTypes, BCS, HexString, MaybeHexString, AptosClient, FaucetClient, AptosAccountObject } from "aptos";
import {aptosAccountObject1, aptosAccountObject2} from "./constants";
import sha3 from 'js-sha3';
export const NODE_URL = "http://0.0.0.0:8080/v1";
export const FAUCET_URL = "http://localhost:8081";

// Note: this script does not use deployer/resource accounts.
// It is only for testing on-chain Coin creation

const client = new AptosClient(NODE_URL);

async function deployCoinOnChain(contractAddress: HexString, accountFrom: AptosAccount): Promise<string> {
    const scriptFunctionPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
      TxnBuilderTypes.EntryFunction.natural(
        `${contractAddress.toString()}::deploy_coin`,
        "deployCoin",
        [],
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
    let hash = await deployCoinOnChain(deployed.address(), accountFrom);
    console.log("tx hash: ", hash);
}

if (require.main === module) {
    main().then((resp) => console.log(resp));
}
