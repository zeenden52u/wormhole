import { useEffect, useState } from "react";
import axios from "axios";
import {
  DataWrapper,
  errorDataWrapper,
  fetchDataWrapper,
  receiveDataWrapper,
} from "../store/helpers";
import { TOKEN_TRANSFER_STATS_URL } from "../utils/consts";

export interface TokenTransfer {
  Symbol: string;
  Name: string;
  CoinGeckoId: string;
  TokenAddress: string;
  NotionalTransferred: number;
  NotionalTransferredToChain: {
    [targetChainId: number]: number;
  };
}

export interface TokenTransferStats {
  [timeFrame: string]: {
    [sourceChainId: string]: {
      NotionalTransferred: number;
      Transfers: {
        [address: string]: TokenTransfer;
      };
    };
  };
}

const useTokenTransferStats = () => {
  const [stats, setStats] = useState<DataWrapper<TokenTransferStats>>(
    fetchDataWrapper()
  );

  useEffect(() => {
    let cancelled = false;
    axios
      .get<TokenTransferStats>(TOKEN_TRANSFER_STATS_URL)
      .then((response) => {
        if (!cancelled) {
          setStats(receiveDataWrapper(response.data));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStats(errorDataWrapper(error));
        }
        console.error(error);
      });
  }, []);

  return stats;
};

export default useTokenTransferStats;
