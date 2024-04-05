package connectors

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"go.uber.org/zap/zaptest"
	"go.uber.org/zap/zaptest/observer"

	ethAbi "github.com/certusone/wormhole/node/pkg/watchers/evm/connectors/ethabi"

	ethereum "github.com/ethereum/go-ethereum"
	ethCommon "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	ethTypes "github.com/ethereum/go-ethereum/core/types"
	ethClient "github.com/ethereum/go-ethereum/ethclient"
	ethEvent "github.com/ethereum/go-ethereum/event"
	ethRpc "github.com/ethereum/go-ethereum/rpc"
)

// mockConnectorForPoller implements the connector interface for testing purposes.
type mockConnectorForPoller struct {
	address           ethCommon.Address
	client            *ethClient.Client
	mutex             sync.Mutex
	headSink          chan<- *ethTypes.Header
	sub               ethEvent.Subscription
	err               error
	persistentError   bool
	blockNumbers      []uint64
	prevBlockNumber   uint64
	latestBlockNumber uint64
}

// setError takes an error which will be returned on the next RPC call. The error will persist until cleared.
func (m *mockConnectorForPoller) setError(err error) {
	m.mutex.Lock()
	m.err = err
	m.persistentError = true
	m.mutex.Unlock()
}

// setSingleError takes an error which will be returned on the next RPC call. After that, the error is reset to nil.
func (m *mockConnectorForPoller) setSingleError(err error) {
	m.mutex.Lock()
	m.err = err
	m.persistentError = false
	m.mutex.Unlock()
}

func (e *mockConnectorForPoller) NetworkName() string {
	return "mockConnectorForPoller"
}

func (e *mockConnectorForPoller) ContractAddress() ethCommon.Address {
	return e.address
}

func (e *mockConnectorForPoller) GetCurrentGuardianSetIndex(ctx context.Context) (uint32, error) {
	return 0, fmt.Errorf("not implemented")
}

func (e *mockConnectorForPoller) GetGuardianSet(ctx context.Context, index uint32) (ethAbi.StructsGuardianSet, error) {
	return ethAbi.StructsGuardianSet{}, fmt.Errorf("not implemented")
}

func (e *mockConnectorForPoller) WatchLogMessagePublished(ctx context.Context, errC chan error, sink chan<- *ethAbi.AbiLogMessagePublished) (ethEvent.Subscription, error) {
	var s ethEvent.Subscription
	return s, fmt.Errorf("not implemented")
}

func (e *mockConnectorForPoller) TransactionReceipt(ctx context.Context, txHash ethCommon.Hash) (*ethTypes.Receipt, error) {
	return nil, fmt.Errorf("not implemented")
}

func (e *mockConnectorForPoller) TimeOfBlockByHash(ctx context.Context, hash ethCommon.Hash) (uint64, error) {
	return 0, fmt.Errorf("not implemented")
}

func (e *mockConnectorForPoller) ParseLogMessagePublished(log ethTypes.Log) (*ethAbi.AbiLogMessagePublished, error) {
	return nil, fmt.Errorf("not implemented")
}

func (e *mockConnectorForPoller) SubscribeForBlocks(ctx context.Context, errC chan error, sink chan<- *NewBlock) (ethereum.Subscription, error) {
	return e.sub, fmt.Errorf("not implemented")
}

func (e *mockConnectorForPoller) RawCallContext(ctx context.Context, result interface{}, method string, args ...interface{}) (err error) {
	if method != "eth_getBlockByNumber" {
		panic("method not implemented by mockConnectorForPoller")
	}

	if len(args) != 2 {
		panic("invalid args in RawCallContext")
	}

	e.mutex.Lock()
	defer e.mutex.Unlock()

	// If they set the error, return that immediately.
	if e.err != nil {
		err = e.err
		if !e.persistentError {
			e.err = nil
		}
		return
	}

	var blockNumber uint64
	if args[0] == "latest" {
		blockNumber = e.latestBlockNumber
	} else {
		blockNumber, err = strconv.ParseUint(strings.TrimPrefix(args[0].(string), "0x"), 16, 64)
		if err != nil {
			panic("failed to parse block number")
		}
	}
	str := fmt.Sprintf(`{"author":"0x24c275f0719fdaec6356c4eb9f39ecb9c4d37ce1","baseFeePerGas":"0x3b9aca00","difficulty":"0x0","extraData":"0x","gasLimit":"0xe4e1c0","gasUsed":"0x0","hash":"0xfc8b62a31110121c57cfcccfaf2b147cc2c13b6d01bde4737846cefd29f045cf","logsBloom":"0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","miner":"0x24c275f0719fdaec6356c4eb9f39ecb9c4d37ce1","nonce":"0x0000000000000000","number":"0x%x","parentHash":"0x09d6d33a658b712f41db7fb9f775f94911ae0132123116aa4f8cf3da9f774e89","receiptsRoot":"0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421","sha3Uncles":"0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347","size":"0x201","stateRoot":"0x0409ed10e03fd49424ae1489c6fbc6ff1897f45d0e214655ebdb8df94eedc3c0","timestamp":"0x6373ec24","totalDifficulty":"0x0","transactions":[],"transactionsRoot":"0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421","uncles":[]}`, blockNumber)
	err = json.Unmarshal([]byte(str), &result)
	e.prevBlockNumber = blockNumber
	return
}

func (e *mockConnectorForPoller) RawBatchCallContext(ctx context.Context, b []ethRpc.BatchElem) error {
	panic("method not implemented by mockConnectorForPoller")
}

func (e *mockConnectorForPoller) setLatestBlockNumber(blockNumber uint64) {
	e.mutex.Lock()
	e.latestBlockNumber = blockNumber
	e.mutex.Unlock()
}

func (e *mockConnectorForPoller) postLatestBlockNumber(blockNumber uint64) {
	e.mutex.Lock()
	e.latestBlockNumber = blockNumber
	e.mutex.Unlock()
	e.headSink <- &ethTypes.Header{
		Number: big.NewInt(int64(blockNumber)),
		Time:   blockNumber,
	}
}

func (e *mockConnectorForPoller) expectedHash() ethCommon.Hash {
	return ethCommon.HexToHash("0xfc8b62a31110121c57cfcccfaf2b147cc2c13b6d01bde4737846cefd29f045cf")
}

func (e *mockConnectorForPoller) Client() *ethClient.Client {
	return e.client
}

func (e *mockConnectorForPoller) SubscribeNewHead(ctx context.Context, ch chan<- *types.Header) (ethereum.Subscription, error) {
	e.headSink = ch
	return mockSubscription{}, nil
}

type mockFinalizerForPoller struct {
	mutex          sync.Mutex
	finalizedBlock uint64
}

func newMockFinalizerForPoller(finalizedBlock uint64) *mockFinalizerForPoller {
	return &mockFinalizerForPoller{finalizedBlock: finalizedBlock}
}

func (f *mockFinalizerForPoller) setFinalizedBlock(finalizedBlock uint64) {
	f.mutex.Lock()
	defer f.mutex.Unlock()
	f.finalizedBlock = finalizedBlock
}

func (f *mockFinalizerForPoller) IsBlockFinalized(ctx context.Context, block *NewBlock) (bool, error) {
	f.mutex.Lock()
	defer f.mutex.Unlock()
	return block.Number.Uint64() <= f.finalizedBlock, nil
}

func shouldHaveLatestOnly(t *testing.T, block []*NewBlock, blockNum uint64) {
	require.Equal(t, 1, len(block))
	assert.Equal(t, uint64(blockNum), block[0].Number.Uint64())
	assert.Equal(t, Latest, block[0].Finality)
	// Can't check hash on latest because it's generated on the fly by geth.
}

func shouldHaveMultipleLatest(t *testing.T, block []*NewBlock, blockNum uint64, count int) {
	require.Equal(t, count, len(block))
	for idx := 0; idx < count; idx++ {
		assert.Equal(t, uint64(blockNum+uint64(idx)), block[idx].Number.Uint64())
		assert.Equal(t, Latest, block[idx].Finality)
		// Can't check hash on latest because it's generated on the fly by geth.
	}
}

func shouldHaveFinalizedAndSafeButNotLatest(t *testing.T, block []*NewBlock, blockNum uint64, expectedHash ethCommon.Hash) {
	require.Equal(t, 2, len(block))
	assert.Equal(t, uint64(blockNum), block[0].Number.Uint64())
	assert.Equal(t, Finalized, block[0].Finality)
	assert.Equal(t, expectedHash, block[0].Hash)
	assert.Equal(t, uint64(blockNum), block[1].Number.Uint64())
	assert.Equal(t, Safe, block[1].Finality)
	assert.Equal(t, expectedHash, block[1].Hash)
}

func shouldHaveMultipleFinalizedAndSafe(t *testing.T, block []*NewBlock, blockNum uint64, expectedPairsOfBlocks int, expectedHash ethCommon.Hash) {
	require.Equal(t, expectedPairsOfBlocks*2, len(block))
	for count := 0; count < expectedPairsOfBlocks; count++ {
		finalizedIdx := count * 2
		assert.Equal(t, uint64(blockNum), block[finalizedIdx].Number.Uint64())
		assert.Equal(t, Finalized, block[finalizedIdx].Finality)
		assert.Equal(t, expectedHash, block[finalizedIdx].Hash)
		assert.Equal(t, uint64(blockNum), block[finalizedIdx+1].Number.Uint64())
		assert.Equal(t, Safe, block[finalizedIdx+1].Finality)
		assert.Equal(t, expectedHash, block[finalizedIdx+1].Hash)
		blockNum += 1
	}
}

// setupLogsCapture is a helper function for making a zap logger/observer combination for testing that certain logs have been made
func setupLogsCapture(t testing.TB, options ...zap.Option) (*zap.Logger, *observer.ObservedLogs) {
	t.Helper()
	observedCore, observedLogs := observer.New(zap.InfoLevel)
	consoleLogger := zaptest.NewLogger(t, zaptest.Level(zap.InfoLevel))
	parentLogger := zap.New(zapcore.NewTee(observedCore, consoleLogger.Core()), options...)
	return parentLogger, observedLogs
}

// TestBlockPoller is one big, ugly test because of all the set up required.
func TestBlockPoller(t *testing.T) {
	ctx := context.Background()
	logger, logObserver := setupLogsCapture(t)
	baseConnector := mockConnectorForPoller{blockNumbers: []uint64{}}

	finalizer := newMockFinalizerForPoller(3185160)
	require.NotNil(t, finalizer)

	poller := &FinalizerPollConnector{
		Connector: &baseConnector,
		logger:    logger,
		Delay:     1 * time.Millisecond,
		finalizer: finalizer,
	}

	// The go routines will post results here.
	var mutex sync.Mutex
	var block []*NewBlock
	var publishedErr error
	var publishedSubErr error

	// Set the initial block number. This gets read at the start of SubscribeForBlocks.
	baseConnector.setLatestBlockNumber(3185164)

	// Subscribe for events to be processed by our go routine.
	headSink := make(chan *NewBlock, 2)
	errC := make(chan error)

	headerSubscription, subErr := poller.SubscribeForBlocks(ctx, errC, headSink)
	require.NoError(t, subErr)
	require.NotNil(t, headerSubscription)
	defer headerSubscription.Unsubscribe()

	// This routine receives the output of the poller and updates our local state.
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case thisErr := <-errC:
				mutex.Lock()
				publishedErr = thisErr
				mutex.Unlock()
			case thisErr := <-headerSubscription.Err():
				mutex.Lock()
				publishedSubErr = thisErr
				mutex.Unlock()
			case thisBlock := <-headSink:
				require.NotNil(t, thisBlock)
				mutex.Lock()
				block = append(block, thisBlock)
				mutex.Unlock()
			}
		}
	}()

	// First sleep a bit and make sure there were no start up errors.
	time.Sleep(10 * time.Millisecond)
	mutex.Lock()
	require.NoError(t, publishedErr)
	require.NoError(t, publishedSubErr)
	assert.Nil(t, block)
	mutex.Unlock()

	// Post the first new block and verify we see it as latest with nothing else.
	baseConnector.postLatestBlockNumber(3185165)
	time.Sleep(10 * time.Millisecond)
	mutex.Lock()
	require.NoError(t, publishedErr)
	require.NoError(t, publishedSubErr)
	shouldHaveLatestOnly(t, block, 3185165)
	block = nil
	mutex.Unlock()

	// Sleep some more and verify we don't see any more blocks, since we haven't posted a new one.
	time.Sleep(10 * time.Millisecond)
	mutex.Lock()
	require.NoError(t, publishedErr)
	require.NoError(t, publishedSubErr)
	require.Nil(t, block)
	mutex.Unlock()

	// Post the next block and verify we see it as latest with nothing else.
	baseConnector.postLatestBlockNumber(3185166)
	time.Sleep(10 * time.Millisecond)
	mutex.Lock()
	require.NoError(t, publishedErr)
	require.NoError(t, publishedSubErr)
	shouldHaveLatestOnly(t, block, 3185166)
	block = nil
	mutex.Unlock()

	// Set a finalized block and verify we get it as finalized and safe.
	finalizer.setFinalizedBlock(3185165)
	time.Sleep(10 * time.Millisecond)
	mutex.Lock()
	require.NoError(t, publishedErr)
	require.NoError(t, publishedSubErr)
	shouldHaveMultipleFinalizedAndSafe(t, block, 3185161, 5, baseConnector.expectedHash())
	block = nil
	mutex.Unlock()

	// Post the next latest block. We should only see latest.
	baseConnector.postLatestBlockNumber(3185167)
	time.Sleep(10 * time.Millisecond)
	mutex.Lock()
	require.NoError(t, publishedErr)
	require.NoError(t, publishedSubErr)
	shouldHaveLatestOnly(t, block, 3185167)
	block = nil
	mutex.Unlock()

	// Post another finalized block. We should see finalized and safe for it.
	finalizer.setFinalizedBlock(3185166)
	time.Sleep(10 * time.Millisecond)
	mutex.Lock()
	require.NoError(t, publishedErr)
	require.NoError(t, publishedSubErr)
	shouldHaveFinalizedAndSafeButNotLatest(t, block, 3185166, baseConnector.expectedHash())
	block = nil
	mutex.Unlock()

	// A single RPC error should not be returned to us.
	publishedErr = nil
	baseConnector.setSingleError(fmt.Errorf("RPC failed"))

	time.Sleep(10 * time.Millisecond)
	mutex.Lock()
	require.NoError(t, publishedErr)
	require.NoError(t, publishedSubErr)
	assert.Equal(t, 0, len(block))

	// Verify that we got the expected error in the logs.
	loggedEntries := logObserver.FilterMessage("polling encountered an error").All()
	require.Equal(t, 1, len(loggedEntries))

	block = nil
	mutex.Unlock()

	// And we should be able to continue after a single error.
	baseConnector.postLatestBlockNumber(3185168)
	time.Sleep(10 * time.Millisecond)
	mutex.Lock()
	require.NoError(t, publishedErr)
	require.NoError(t, publishedSubErr)
	shouldHaveLatestOnly(t, block, 3185168)
	block = nil
	mutex.Unlock()

	// Post the next five latest blocks.
	for count := 0; count < 5; count++ {
		baseConnector.postLatestBlockNumber(3185169 + uint64(count))
	}
	time.Sleep(10 * time.Millisecond)
	mutex.Lock()
	require.NoError(t, publishedErr)
	require.NoError(t, publishedSubErr)
	shouldHaveMultipleLatest(t, block, 3185169, 5)
	block = nil
	mutex.Unlock()

	// Then move the finalized block forward multiple blocks and it should play out the gap.
	finalizer.setFinalizedBlock(3185172)
	time.Sleep(10 * time.Millisecond)
	mutex.Lock()
	require.NoError(t, publishedErr)
	require.NoError(t, publishedSubErr)
	shouldHaveMultipleFinalizedAndSafe(t, block, 3185167, 6, baseConnector.expectedHash())
	block = nil
	mutex.Unlock()

	//
	// NOTE: This should be the last part of this test because it kills the poller!
	//

	// A persistent RPC error should be returned to us.
	baseConnector.setError(fmt.Errorf("RPC failed"))
	time.Sleep(10 * time.Millisecond)
	mutex.Lock()
	assert.Error(t, publishedErr)
	require.NoError(t, publishedSubErr)
	assert.Nil(t, block)
	baseConnector.setError(nil)
	publishedErr = nil
	mutex.Unlock()
}

type finalizedTester struct {
	latestFinalized uint64
}

func (obj finalizedTester) checkIfBlockIsFinalized(ctx context.Context, blockNum uint64) (bool, *NewBlock, error) {
	block := &NewBlock{
		Number:   big.NewInt(int64(blockNum)),
		Time:     123456,
		Hash:     ethCommon.HexToHash("0xfc8b62a31110121c57cfcccfaf2b147cc2c13b6d01bde4737846cefd29f045cf"),
		Finality: Latest,
	}
	return blockNum <= obj.latestFinalized, block, nil
}

func Test_findLatestFinalizedBlock(t *testing.T) {
	ctx := context.Background()

	latestFinalized := uint64(123456)
	block, err := findLatestFinalizedBlock(ctx, 123000, 124000, finalizedTester{latestFinalized: latestFinalized})
	require.NoError(t, err)
	require.NotNil(t, block)
	assert.Equal(t, latestFinalized, block.Number.Uint64())

	latestFinalized = uint64(123000)
	block, err = findLatestFinalizedBlock(ctx, 123000, 123001, finalizedTester{latestFinalized: latestFinalized})
	require.NoError(t, err)
	require.NotNil(t, block)
	assert.Equal(t, latestFinalized, block.Number.Uint64())

	latestFinalized = uint64(123500)
	block, err = findLatestFinalizedBlock(ctx, 123000, 124000, finalizedTester{latestFinalized: latestFinalized})
	require.NoError(t, err)
	require.NotNil(t, block)
	assert.Equal(t, latestFinalized, block.Number.Uint64())

	startBlock := uint64(123000)
	endBlock := uint64(124000)
	for latestFinalized := startBlock; latestFinalized < endBlock; latestFinalized++ {
		block, err = findLatestFinalizedBlock(ctx, startBlock, endBlock, finalizedTester{latestFinalized: latestFinalized})
		require.NoError(t, err)
		require.NotNil(t, block)
		assert.Equal(t, latestFinalized, block.Number.Uint64())
	}
}
