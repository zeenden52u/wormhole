package connectors

import (
	"context"
	"fmt"
	"time"

	"github.com/certusone/wormhole/node/pkg/common"

	ethereum "github.com/ethereum/go-ethereum"
	ethTypes "github.com/ethereum/go-ethereum/core/types"

	"go.uber.org/zap"
)

// PollFinalizer is the interface to the object used to check if a block is finalized.
type PollFinalizer interface {
	IsBlockFinalized(ctx context.Context, block *NewBlock) (bool, error)
}

// FinalizerPollConnector polls for new blocks. It takes a finalizer which will be used to determine when a block is finalized.
type FinalizerPollConnector struct {
	Connector
	logger    *zap.Logger
	Delay     time.Duration
	finalizer PollFinalizer
}

// NewFinalizerPollConnector creates a new poll connector using the specified finalizer.
func NewFinalizerPollConnector(logger *zap.Logger, baseConnector Connector, finalizer PollFinalizer, delay time.Duration) (*FinalizerPollConnector, error) {
	if finalizer == nil {
		panic("finalizer must not be nil")
	}

	connector := &FinalizerPollConnector{
		Connector: baseConnector,
		logger:    logger,
		Delay:     delay,
		finalizer: finalizer,
	}

	return connector, nil
}

// SubscribeForBlocks starts polling. It implements the standard connector interface.
func (b *FinalizerPollConnector) SubscribeForBlocks(ctx context.Context, errC chan error, sink chan<- *NewBlock) (ethereum.Subscription, error) {
	// Use the standard geth head sink to get latest blocks. We do this so that we will be notified of rollbacks. The following document
	// indicates that the subscription will receive a replay of all blocks affected by a rollback. This is important for latest because the
	// timestamp cache needs to be updated on a rollback. We can only consider polling for latest if we can guarantee that we won't miss rollbacks.
	// https://ethereum.org/en/developers/tutorials/using-websockets/#subscription-types
	headSink := make(chan *ethTypes.Header, 2)
	headerSubscription, err := b.Connector.SubscribeNewHead(ctx, headSink)
	if err != nil {
		return headerSubscription, fmt.Errorf("failed to subscribe for latest blocks: %w", err)
	}

	// Get the latest finalized block. We don't actually publish it, we just use it to detect the next finalized block.
	initialLatest, err := GetLatestBlock(ctx, b.logger, b.Connector)
	if err != nil {
		return headerSubscription, fmt.Errorf("failed to get latest block: %w", err)
	}

	// Find our latest finalized block. We don't actually publish it, we just use it to detect the next finalized block.
	initialFinalized, err := b.getFinalizedStartingPoint(ctx, initialLatest)
	if err != nil {
		return headerSubscription, fmt.Errorf("failed to get last finalized block: %w", err)
	}

	common.RunWithScissors(ctx, errC, "finalizer_poller", func(ctx context.Context) error {
		latest := initialLatest
		finalized := initialFinalized
		timer := time.NewTimer(b.Delay)
		defer timer.Stop()
		errCount := 0
		for {
			select {
			case <-ctx.Done():
				return nil
			case ev := <-headSink:
				if ev == nil {
					b.logger.Error("new latest header event is nil")
					continue
				}
				if ev.Number == nil {
					b.logger.Error("new latest header block number is nil")
					continue
				}
				latest = &NewBlock{
					Number:   ev.Number,
					Time:     ev.Time,
					Hash:     ev.Hash(),
					Finality: Latest,
				}
				sink <- latest
			case <-timer.C:
				var err error
				finalized, err = b.pollBlock(ctx, sink, latest, finalized)
				if err != nil {
					errCount++
					b.logger.Error("polling encountered an error", zap.Int("errCount", errCount), zap.Error(err))
					if errCount > 3 {
						errC <- fmt.Errorf("polling encountered too many errors: %w", err)
						return nil
					}
				} else if errCount != 0 {
					errCount = 0
				}
				timer.Reset(b.Delay)
			}
		}
	})

	return headerSubscription, err
}

// pollBlock checks to see if there are any new finalized blocks and publishes them. It returns
// the new last finalized block, or the previous finalized block if there are no new ones.
func (b *FinalizerPollConnector) pollBlock(ctx context.Context, sink chan<- *NewBlock, latest *NewBlock, prevFinalized *NewBlock) (newFinalized *NewBlock, err error) {
	newFinalized = prevFinalized
	if latest.Number.Cmp(prevFinalized.Number) > 0 {
		var finalized bool
		newBlockNum := latest.Number.Uint64()
		for blockNum := prevFinalized.Number.Uint64() + 1; blockNum <= newBlockNum; blockNum++ {
			var block *NewBlock
			block, err = GetBlockByNumberUint64(ctx, b.logger, b.Connector, blockNum, Finalized)
			if err != nil {
				err = fmt.Errorf("failed to get gap block: %w", err)
				return
			}

			finalized, err = b.isBlockFinalized(ctx, block)
			if err != nil {
				err = fmt.Errorf("failed to check finality on block: %w", err)
				return
			}

			if !finalized {
				break
			}

			sink <- block
			sink <- block.Copy(Safe)
			newFinalized = block
		}
	}

	return
}

// isBlockFinalized calls the finalizer and returns the result.
func (b *FinalizerPollConnector) isBlockFinalized(ctx context.Context, block *NewBlock) (bool, error) {
	timeout, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	return b.finalizer.IsBlockFinalized(timeout, block)
}

// getFinalizedStartingPoint attempts to find the latest finalized block. The returned block may not actually be finalized,
// which is okay because it doesn't get published. Instead it will be used as the starting point for checking for new finalized blocks.
func (b *FinalizerPollConnector) getFinalizedStartingPoint(ctx context.Context, latest *NewBlock) (*NewBlock, error) {
	// First see if the latest block is finalized. If so, we are done.
	latestBlockNum := latest.Number.Uint64()
	isFinalized, err := b.isBlockFinalized(ctx, latest)
	if err != nil {
		return nil, fmt.Errorf("failed to determine if block %d is finalized: %w", latestBlockNum, err)
	}
	if isFinalized {
		b.logger.Info("latest block is finalized, using that as the starting point", zap.Uint64("latestBlockNum", latestBlockNum))
		return latest.Copy(Finalized), nil
	}

	// Search backwards in chunks of size `blockInterval`, at most `numTries` times.
	const blockInterval uint64 = 1000
	const numTries int = 10

	// Compute our starting block number, handle the devnet case where it could go negative.
	var blockNum uint64
	if latestBlockNum > blockInterval {
		blockNum = latestBlockNum - blockInterval
	} else {
		blockNum = 1
	}

	var block *NewBlock
	prevBlockNum := latestBlockNum
	for count := 0; count < numTries; count++ {
		isFinalized, block, err = b.checkIfBlockIsFinalized(ctx, blockNum)
		if err != nil {
			return nil, fmt.Errorf("failed to determine if block %d is finalized: %w", blockNum, err)
		}

		if isFinalized {
			break
		}

		prevBlockNum = blockNum
		if blockNum < blockInterval {
			if blockNum == 1 {
				break
			}
			blockNum = 1
		} else {
			blockNum -= blockInterval
		}
	}

	// If we gave up, use the oldest block as our starting point.
	if !isFinalized {
		b.logger.Info("searched all the way back and didn't find a finalized block, using oldest block checked as starting point",
			zap.Uint64("oldestBlockChecked", blockNum),
			zap.Uint64("latestBlock", latestBlockNum),
		)
		return block.Copy(Finalized), nil
	}

	// If we get here, we have found a finalized block. Do a binary search to find the latest finalized block in the range.
	block, err = findLatestFinalizedBlock(ctx, blockNum, prevBlockNum, b)
	if err != nil {
		return nil, fmt.Errorf("failed to find highest finalized block: %w", err)
	}

	b.logger.Info("determined latest finalized block", zap.Uint64("latestFinalizedBlock", block.Number.Uint64()), zap.Uint64("currentLatestBlock", latestBlockNum))
	return block.Copy(Finalized), nil
}

// checkIfBlockIsFinalized reads the specified block and calls the finalizer to see if it is finalized.
func (b *FinalizerPollConnector) checkIfBlockIsFinalized(ctx context.Context, blockNum uint64) (bool, *NewBlock, error) {
	block, err := GetBlockByNumberUint64(ctx, b.logger, b.Connector, blockNum, Finalized)
	if err != nil {
		return false, nil, fmt.Errorf("failed to get block: %w", err)
	}

	isFinalized, err := b.isBlockFinalized(ctx, block)
	if err != nil {
		return false, nil, fmt.Errorf("failed to determine if block %d is finalized: %w", block.Number.Uint64(), err)
	}

	return isFinalized, block, nil
}

// checkForFinalized is the interface to `findLatestFinalizedBlock`.
type checkForFinalized interface {
	checkIfBlockIsFinalized(ctx context.Context, blockNum uint64) (bool, *NewBlock, error)
}

// findLatestFinalizedBlock performs a binary search over a range of blocks to find the latest finalized block.
// This function assumes that block `left` is finalized and block `right` is not, so the last finalized block is somewhere
// between the two, possible `left` but not `right`. It calls `checkForFinalized` on the specified object to check finality.
func findLatestFinalizedBlock(ctx context.Context, left uint64, right uint64, obj checkForFinalized) (*NewBlock, error) {
	for {
		blockNum := (left + right) / 2
		isFinalized, block, err := obj.checkIfBlockIsFinalized(ctx, blockNum)
		if err != nil {
			return nil, fmt.Errorf("failed to determine if block %d is finalized: %w", blockNum, err)
		}
		if isFinalized {
			if left+1 == right {
				return block, nil
			}
			left = blockNum
		} else {
			right = blockNum
		}
	}
}

/*
// This is a simple (useless) example finalizer that can be used to test this poller. It reads the latest finalized
// block on a chain that supports it (such as Sepolia) and uses that to determine finality. Of course, if a chain
// supports querying for finalized, we would use the batch poller, not this one, which is why this is useless.

type TestFinalizer struct {
	conn   Connector
	logger *zap.Logger
}

func NewTestFinalizer(logger *zap.Logger, baseConnector Connector) (*TestFinalizer, error) {
	f := &TestFinalizer{
		conn:   baseConnector,
		logger: logger,
	}

	return f, nil
}

func (f *TestFinalizer) IsBlockFinalized(ctx context.Context, block *NewBlock) (bool, error) {
	fb, err := GetBlockByFinality(ctx, f.logger, f.conn, Finalized)
	if err != nil {
		return false, fmt.Errorf("failed to get latest finalized block: %w", err)
	}
	return block.Number.Uint64() <= fb.Number.Uint64(), nil
}
*/
