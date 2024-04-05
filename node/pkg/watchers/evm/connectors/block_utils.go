package connectors

// This file provides free functions that can be used for reading blocks.

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"go.uber.org/zap"
)

// GetLatestBlock gets the current latest block.
func GetLatestBlock(ctx context.Context, logger *zap.Logger, conn Connector) (*NewBlock, error) {
	return GetBlockByFinality(ctx, logger, conn, Latest)
}

// GetBlockByFinality gets the current latest block with the specified finality.
func GetBlockByFinality(ctx context.Context, logger *zap.Logger, conn Connector, blockFinality FinalityLevel) (*NewBlock, error) {
	return GetBlock(ctx, logger, conn, blockFinality.String(), blockFinality)
}

// GetBlockByNumberUint64 gets the block for the specified number.
func GetBlockByNumberUint64(ctx context.Context, logger *zap.Logger, conn Connector, blockNum uint64, blockFinality FinalityLevel) (*NewBlock, error) {
	return GetBlock(ctx, logger, conn, "0x"+fmt.Sprintf("%x", blockNum), blockFinality)
}

// GetBlock gets the block for the specified tag / number string. It sets the finality in the returned block to the specified value.
func GetBlock(ctx context.Context, logger *zap.Logger, conn Connector, str string, blockFinality FinalityLevel) (*NewBlock, error) {
	timeout, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	var m BlockMarshaller
	err := conn.RawCallContext(timeout, &m, "eth_getBlockByNumber", str, false)
	if err != nil {
		logger.Error("failed to get block",
			zap.String("requested_block", str), zap.Error(err))
		return nil, err
	}
	if m.Number == nil {
		logger.Error("failed to unmarshal block",
			zap.String("requested_block", str),
		)
		return nil, fmt.Errorf("failed to unmarshal block: Number is nil")
	}
	n := big.Int(*m.Number)

	var l1bn *big.Int
	if m.L1BlockNumber != nil {
		bn := big.Int(*m.L1BlockNumber)
		l1bn = &bn
	}

	return &NewBlock{
		Number:        &n,
		Time:          uint64(m.Time),
		Hash:          m.Hash,
		L1BlockNumber: l1bn,
		Finality:      blockFinality,
	}, nil
}
