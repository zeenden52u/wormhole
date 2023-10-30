import { describe, expect, jest, test } from "@jest/globals";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  TokenAccountsFilter,
} from "@solana/web3.js";
import { ethers } from "ethers";

// Borrow consts
import {
  ETH_NODE_URL,
  ETH_PRIVATE_KEY,
  SOLANA_HOST,
  SOLANA_PRIVATE_KEY,
  TEST_ERC20,
  WORMHOLE_RPC_HOSTS,
} from "./utils/consts";

import {
  CONFIG as CONNECT_CONFIG,
  TokenBridge,
  nativeChainAddress,
  normalizeAmount,
  signSendWait,
  api,
  encoding,
  WormholeMessageId
} from "@wormhole-foundation/connect-sdk";
import { SolanaTokenBridge } from "../solana/src";
import { EvmTokenBridge } from "../evm/src";
import { EvmPlatform, getEvmSigner } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform, getSolanaSigner } from "@wormhole-foundation/connect-sdk-solana";

// import "@wormhole-foundation/wormhole-connect-sdk-tokenbridge-evm";
import "@wormhole-foundation/wormhole-connect-sdk-core-evm";
// import "@wormhole-foundation/wormhole-connect-sdk-tokenbridge-solana";
import "@wormhole-foundation/wormhole-connect-sdk-core-solana";

jest.setTimeout(60000);

async function getEthTokenBridge(provider: ethers.Provider): Promise<TokenBridge<'Evm'>> {
  return EvmTokenBridge.fromRpc(provider, CONNECT_CONFIG.Devnet.chains)
}

async function getSolTokenBridge(connection: Connection): Promise<TokenBridge<'Solana'>> {
  return SolanaTokenBridge.fromRpc(connection, CONNECT_CONFIG.Devnet.chains)
}

async function transferFromEthToSolana(): Promise<WormholeMessageId> {
  // create a keypair for Solana
  const connection = new Connection(SOLANA_HOST, "confirmed");
  const keypair = Keypair.fromSecretKey(SOLANA_PRIVATE_KEY);

  const provider = new ethers.WebSocketProvider(ETH_NODE_URL);

  // create a signer for Eth
  const signer = await getEvmSigner(provider, ETH_PRIVATE_KEY);

  const ethTokenBridge = await getEthTokenBridge(provider)
  const solTokenBridge = await getSolTokenBridge(connection)

  const token = nativeChainAddress(["Ethereum", TEST_ERC20])
  const amount = normalizeAmount("1", 18n);

  const solanaMintKey = (await solTokenBridge.getWrappedAsset(token)).unwrap()

  const recipient = await getAssociatedTokenAddress(
    solanaMintKey,
    keypair.publicKey
  );

  // Format to ChainAddress 
  const receiver = nativeChainAddress(["Solana", recipient.toString()])

  // Create transfer transaction generator
  const xfer = ethTokenBridge.transfer(signer.address(), receiver, TEST_ERC20, amount)

  // Sign, send, and wait for confirmation
  const ethChain = EvmPlatform.getChain("Ethereum")
  const txids = await signSendWait(ethChain, xfer, signer)

  // Parse the wormhole message out with sequence info
  const [whm] = await ethChain.parseTransaction(txids[txids.length - 1].txid)
  return whm
}

describe("Ethereum to Solana and Back", () => {
  test("Attest Ethereum ERC-20 to Solana", (done) => {
    (async () => {
      try {
        // create a signer for Eth
        const provider = new ethers.WebSocketProvider(ETH_NODE_URL);
        const ethSigner = await getEvmSigner(provider, ETH_PRIVATE_KEY);

        const ethChain = EvmPlatform.getChain("Ethereum")
        const ethTb = await getEthTokenBridge(provider)

        const attestTxs = ethTb.createAttestation(TEST_ERC20)
        const txids = await signSendWait(ethChain, attestTxs, ethSigner)

        const [whm] = await ethChain.parseTransaction(txids[txids.length - 1].txid)

        // poll until the guardian(s) witness and sign the vaa
        const vaa = await api.getVaaWithRetry(WORMHOLE_RPC_HOSTS[0], whm, "TokenBridge:AttestMeta")

        // Submit the VAA to Solana
        const connection = new Connection(SOLANA_HOST, "confirmed");
        const solSigner = await getSolanaSigner(connection, encoding.b58.encode(SOLANA_PRIVATE_KEY))

        const solChain = SolanaPlatform.getChain("Solana");
        const solTb = await getSolTokenBridge(connection)

        const submitTxs = solTb.submitAttestation(vaa!, solSigner.address())

        await signSendWait(solChain, submitTxs, solSigner)

        provider.destroy();
        done();
      } catch (e) {
        console.error(e);
        done(
          "An error occurred while trying to attest from Ethereum to Solana"
        );
      }
    })();
  });
  test("Ethereum ERC-20 is attested on Solana", async () => {
    const connection = new Connection(SOLANA_HOST, "confirmed");
    const solTb = await getSolTokenBridge(connection)
    const address = solTb.getWrappedAsset(nativeChainAddress(["Ethereum", TEST_ERC20]))
    expect(address).toBeTruthy();
  });
  test("Send Ethereum ERC-20 to Solana", (done) => {
    (async () => {
      try {
        const DECIMALS: number = 18;

        const ethChain = EvmPlatform.getChain("Ethereum")
        const solChain = SolanaPlatform.getChain("Solana")

        // create a signer for Eth
        const provider = new ethers.WebSocketProvider(ETH_NODE_URL);
        const ethSigner = await getEvmSigner(provider, ETH_PRIVATE_KEY);

        // create a keypair for Solana
        const connection = new Connection(SOLANA_HOST, "confirmed");
        const keypair = Keypair.fromSecretKey(SOLANA_PRIVATE_KEY);
        const payerAddress = keypair.publicKey.toString();
        const solSigner = await getSolanaSigner(connection, encoding.b58.encode(keypair.secretKey))

        // Get the token bridge clients
        const ethTb = await getEthTokenBridge(provider);
        const solTb = await getSolTokenBridge(connection)

        // determine destination address - an associated token account
        const tokenId = nativeChainAddress(["Ethereum", TEST_ERC20])

        const amount = normalizeAmount("1", BigInt(DECIMALS));

        const solanaForeignAsset = await solTb.getWrappedAsset(tokenId);
        const solanaMintKey = solanaForeignAsset.unwrap();
        const recipient = await getAssociatedTokenAddress(
          solanaMintKey,
          keypair.publicKey,
        );

        // Get the initial wallet balance of ERC20 on Eth
        const initialErc20BalOnEth = await ethChain.getBalance(ethSigner.address(), tokenId.address.toUniversalAddress()) ?? 0n

        // Get the initial balance on Solana
        const initialSolanaBalance = await solChain.getBalance(solSigner.address(), solanaForeignAsset) ?? 0n

        // Send the transfer
        const xfer = ethTb.transfer(ethSigner.address(), nativeChainAddress(["Solana", recipient.toBase58()]), TEST_ERC20, amount)
        const txids = await signSendWait(ethChain, xfer, ethSigner)

        // Get the VAA from the wormhole message emitted in events
        const [whm] = await ethChain.parseTransaction(txids[txids.length - 1].txid)
        const vaa = await api.getVaaWithRetry(WORMHOLE_RPC_HOSTS[0], whm, "TokenBridge:Transfer")

        expect(await solTb.isTransferCompleted(vaa!)).toBe(false);

        // redeem tokens on solana
        const redeemTxs = solTb.redeem(payerAddress, vaa!)
        await signSendWait(solChain, redeemTxs, solSigner)

        expect(await solTb.isTransferCompleted(vaa!)).toBe(true);

        // Get the final balances  
        const finalErc20BalOnEth = await ethChain.getBalance(ethSigner.address(), tokenId.address.toUniversalAddress()) ?? 0n
        expect(initialErc20BalOnEth - finalErc20BalOnEth).toEqual(amount);

        const finalSolanaBalance = await solChain.getBalance(solSigner.address(), solanaForeignAsset) ?? 0n
        expect(finalSolanaBalance - initialSolanaBalance).toEqual(1n);

        provider.destroy();
        done();
      } catch (e) {
        console.error(e);
        done("An error occurred while trying to send from Ethereum to Solana");
      }
    })();
  });
});
