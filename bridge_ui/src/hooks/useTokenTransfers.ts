import { useEffect, useState } from "react";
import axios from "axios";
import {
  DataWrapper,
  errorDataWrapper,
  fetchDataWrapper,
  receiveDataWrapper,
} from "../store/helpers";
import { TOKEN_TRANSFERS_URL } from "../utils/consts";

export interface TokenTransfer {
  Symbol: string;
  Name: string;
  CoinGeckoId: string;
  NotionalTransferredToChain: {
    [targetChainId: number]: number;
  };
}

export interface TokenTransfers {
  [period: string]: {
    [sourceChainId: string]: {
      NotionalTransferred: number;
      Transfers: {
        [address: string]: TokenTransfer;
      };
    };
  };
}

const useTokenTransfers = () => {
  const [tokenTransfers, setTokenTransfers] = useState<
    DataWrapper<TokenTransfers>
  >(fetchDataWrapper());

  useEffect(() => {
    let cancelled = false;
    axios
      .get<TokenTransfers>(TOKEN_TRANSFERS_URL)
      .then((response) => {
        if (!cancelled) {
          setTokenTransfers(receiveDataWrapper(response.data));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setTokenTransfers(errorDataWrapper(error));
        }
        console.error(error);
      });
  }, []);

  return tokenTransfers;
};

export default useTokenTransfers;
