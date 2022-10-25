// Here are some slots that contained transaction unmarshal errors:
// 2022-10-25T16:59:23.996Z	ERROR	guardian-0.root.solwatch-confirmed	failed to unmarshal transaction	{"slot": 171202046, "txNum": 39, "dataLen": 709, "error": "required [1] byte, remaining [0]"}
// 2022-10-25T16:59:24.401Z	ERROR	guardian-0.root.solwatch-finalized	failed to unmarshal transaction	{"slot": 171202016, "txNum": 15, "dataLen": 709, "error": "required [1] byte, remaining [0]"}
// 2022-10-25T16:59:26.447Z	ERROR	guardian-0.root.solwatch-confirmed	failed to unmarshal transaction	{"slot": 171202053, "txNum": 6, "dataLen": 709, "error": "required [1] byte, remaining [0]"}
// 2022-10-25T16:59:29.168Z	ERROR	guardian-0.root.solwatch-confirmed	failed to unmarshal transaction	{"slot": 171202060, "txNum": 15, "dataLen": 709, "error": "required [1] byte, remaining [0]"}
// 2022-10-25T16:59:29.398Z	ERROR	guardian-0.root.solwatch-finalized	failed to unmarshal transaction	{"slot": 171202028, "txNum": 16, "dataLen": 709, "error": "required [1] byte, remaining [0]"}
// 2022-10-25T16:59:31.297Z	ERROR	guardian-0.root.solwatch-confirmed	failed to unmarshal transaction	{"slot": 171202066, "txNum": 39, "dataLen": 709, "error": "required [1] byte, remaining [0]"}
// 2022-10-25T16:59:32.033Z	ERROR	guardian-0.root.solwatch-finalized	failed to unmarshal transaction	{"slot": 171202035, "txNum": 2, "dataLen": 709, "error": "not enough data: 249443522 bytes missing"}
// 2022-10-25T16:59:35.220Z	ERROR	guardian-0.root.solwatch-finalized	failed to unmarshal transaction	{"slot": 171202046, "txNum": 39, "dataLen": 709, "error": "required [1] byte, remaining [0]"}

package main

import (
	"context"
	"encoding/hex"
	"flag"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"

	"go.uber.org/zap"
)

var (
	solanaRPC = flag.String("solanaRPC", "https://rpc.ankr.com/solana_devnet", "Solana RPC address")
	slotNum   = flag.Uint64("slotNum", 171202053, "Solana slot number to query")
)

const rpcTimeout = time.Second * 5

func main() {
	flag.Parse()

	logger, _ := zap.NewDevelopment()
	ctx := context.Background()
	rpcClient := rpc.New(*solanaRPC)

	fetchBlock(ctx, logger, rpcClient, *slotNum, 0)
}

func fetchBlock(ctx context.Context, logger *zap.Logger, rpcClient *rpc.Client, slot uint64, emptyRetry uint) {
	rCtx, cancel := context.WithTimeout(ctx, rpcTimeout)
	defer cancel()

	rewards := false
	maxSupportedTransactionVersion := uint64(0)
	out, err := rpcClient.GetBlockWithOpts(rCtx, slot, &rpc.GetBlockOpts{
		Encoding:                       solana.EncodingBase64, // solana-go doesn't support json encoding.
		TransactionDetails:             "full",
		Rewards:                        &rewards,
		Commitment:                     rpc.CommitmentFinalized,
		MaxSupportedTransactionVersion: &maxSupportedTransactionVersion,
	})

	if err != nil {
		logger.Error("failed to get block", zap.Uint64("slot", slot), zap.Error(err))
		return
	}

	if out == nil {
		// Per the API, nil just means the block is not confirmed.
		logger.Info("block is not yet finalized", zap.Uint64("slot", slot))
		return
	}

	logger.Info("fetched block",
		zap.Uint64("slot", slot),
		zap.Int("num_tx", len(out.Transactions)),
		zap.String("commitment", string(rpc.CommitmentFinalized)))

	for txNum, txRpc := range out.Transactions {
		// logger.Info("Tick")
		if txRpc.Meta.Err != nil {
			logger.Info("Transaction failed, skipping it")
			continue
		}
		if txRpc.Transaction == nil {
			logger.Info("Transaction is nil, skipping it")
			continue
		}
		if len(txRpc.Transaction.GetBinary()) == 0 {
			logger.Info("Transaction contains no binary data, skipping it")
			continue
		}
		_, err := txRpc.GetTransaction()
		if err != nil {
			logger.Error("failed to unmarshal transaction",
				zap.Uint64("slot", slot),
				zap.Int("txNum", txNum),
				zap.Int("dataLen", len(txRpc.Transaction.GetBinary())),
				zap.Error(err),
				zap.String("data", hex.EncodeToString(txRpc.Transaction.GetBinary())),
			)
			// logger.Error("transaction: ", zap.String("data", hex.EncodeToString(txRpc.Transaction.GetBinary())))
			continue
		}

		logger.Info("unmarshalled transaction", zap.Int("txNum", txNum))
	}
}
