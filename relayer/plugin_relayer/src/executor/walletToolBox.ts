import * as wh from "@certusone/wormhole-sdk";
import { ethers } from "ethers";
import {
  EVMWallet,
  Providers,
  SolanaWallet,
  WalletToolBox,
} from "plugin_interface";
import * as solana from "@solana/web3.js";

export function createWalletToolbox(
  providers: Providers,
  privateKey: string,
  chainId: wh.ChainId
): WalletToolBox<any> {
  if (wh.isEVMChain(chainId)) {
    return createEVMWalletToolBox(providers, privateKey, chainId);
  }
  switch (chainId) {
    case wh.CHAIN_ID_SOLANA:
      console.log(privateKey, "pkey")
      return createSolanaWalletToolBox(
        providers,
        new Uint8Array(privateKey as unknown as number[])
      );
  }
  throw new Error(`Spawned worker for unknown chainId ${chainId}`);
}

function createEVMWalletToolBox(
  providers: Providers,
  privateKey: string,
  chainId: wh.EVMChainId
): WalletToolBox<EVMWallet> {
  return {
    ...providers,
    wallet: new ethers.Wallet(privateKey, providers.evm[chainId]),
  };
}

function createSolanaWalletToolBox(
  providers: Providers,
  privateKey: Uint8Array
): WalletToolBox<SolanaWallet> {
  return {
    ...providers,
    wallet: {
      conn: providers.solana,
      payer: solana.Keypair.fromSecretKey(privateKey),
    },
  };
}

function maybeConcat<T>(...arrs: (T[] | undefined)[]): T[] {
  return arrs.flatMap(arr => (arr ? arr : []));
}
