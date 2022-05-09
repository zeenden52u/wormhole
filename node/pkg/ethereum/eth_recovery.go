package ethereum

import (
	"context"
	// "encoding/hex"
	"encoding/json"
	// "flag"
	"fmt"
	"io"
	// "log"
	"net/http"
	// "net/http/cookiejar"
	// "strconv"
	"strings"
	// "time"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/db"
	// "github.com/certusone/wormhole/node/pkg/ethereum/abi"
	// gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	nodev1 "github.com/certusone/wormhole/node/pkg/proto/node/v1"
	"github.com/certusone/wormhole/node/pkg/vaa"
	// abi2 "github.com/ethereum/go-ethereum/accounts/abi"
	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	// "golang.org/x/time/rate"
	// "google.golang.org/grpc"
)

var EtherscanAPIMap = map[vaa.ChainID]string{
	vaa.ChainIDEthereum:  "https://api.etherscan.io/api",
	vaa.ChainIDBSC:       "https://api.bscscan.com/api",
	vaa.ChainIDAvalanche: "https://api.snowtrace.io/api",
	vaa.ChainIDPolygon:   "https://api.polygonscan.com/api",
	vaa.ChainIDOasis:     "https://explorer.emerald.oasis.dev/api",
	vaa.ChainIDAurora:    "https://explorer.mainnet.aurora.dev/api",
	vaa.ChainIDFantom:    "https://api.ftmscan.com/api",
}

var CoreContractMap = map[vaa.ChainID]string{
	vaa.ChainIDEthereum:  "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
	vaa.ChainIDBSC:       "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
	vaa.ChainIDAvalanche: "0x54a8e5f9c4CbA08F9943965859F6c34eAF03E26c",
	vaa.ChainIDPolygon:   "0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7",
	vaa.ChainIDOasis:     "0xfe8cd454b4a1ca468b57d79c0cc77ef5b6f64585", // <- converted to all lower case for easy compares
	vaa.ChainIDAurora:    "0xa321448d90d4e5b0a732867c18ea198e75cac48e",
	vaa.ChainIDFantom:    strings.ToLower("0x126783A6Cb203a3E35344528B26ca3a0489a1485"),
}

var TokenLockupTopic = eth_common.HexToHash("0x6eb224fb001ed210e379b335e35efe88672a8ce935d981a6896b27ffdf52a3b2")

type LogEntry struct {
	// 0x98f3c9e6e3face36baad05fe09d375ef1464288b
	Address string `json:"address"`
	// [
	//  "0x6eb224fb001ed210e379b335e35efe88672a8ce935d981a6896b27ffdf52a3b2",
	//  "0x0000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585"
	// ]
	Topics []string `json:"topics"`
	// Hex-encoded log data
	Data string `json:"data"`
	// 0xcaebbf
	BlockNumber string `json:"blockNumber"`
	// 0x614fd32b
	TimeStamp string `json:"timeStamp"`
	// 0x960778c48
	GasPrice string `json:"gasPrice"`
	// 0x139d5
	GasUsed string `json:"gasUsed"`
	// 0x18d
	LogIndex string `json:"logIndex"`
	// 0xcc5d73aea74ffe6c8e5e9c212da7eb3ea334f41ac3fd600a9979de727535c849
	TransactionHash string `json:"transactionHash"`
	// 0x117
	TransactionIndex string `json:"transactionIndex"`
}

type LogResponse struct {
	// "1" if ok, "0" if error
	Status string `json:"status"`
	// "OK" if ok, "NOTOK" otherwise
	Message string `json:"message"`
	// String when status is "0", result type otherwise.
	Result json.RawMessage `json:"result"`
}

func GetCurrentHeight(chainId vaa.ChainID, ctx context.Context, c *http.Client, api, key string, showErr bool) (uint64, error) {
	var req *http.Request
	var err error
	if chainId == vaa.ChainIDOasis || chainId == vaa.ChainIDAurora {
		// This is the BlockScout based explorer leg
		req, err = http.NewRequest("GET", fmt.Sprintf("%s?module=block&action=eth_block_number", api), nil)
	} else {
		req, err = http.NewRequest("GET", fmt.Sprintf("%s?module=proxy&action=eth_blockNumber&apikey=%s", api, key), nil)
	}
	if err != nil {
		panic(err)
	}

	resp, err := c.Do(req.WithContext(ctx))
	if err != nil {
		return 0, fmt.Errorf("failed to get current height: %w", err)
	}

	defer resp.Body.Close()

	var r struct {
		Result string `json:"result"`
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK && showErr {
		fmt.Println(string(body))
	}

	if err := json.Unmarshal(body, &r); err != nil {
		return 0, fmt.Errorf("failed to decode response: %w", err)
	}

	return hexutil.DecodeUint64(r.Result)
}

func GetLogs(chainId vaa.ChainID, ctx context.Context, c *http.Client, api, key, contract, topic0 string, from, to string, showErr bool) ([]*LogEntry, error) {
	var req *http.Request
	var err error
	if chainId == vaa.ChainIDOasis || chainId == vaa.ChainIDAurora {
		// This is the BlockScout based explorer leg
		req, err = http.NewRequestWithContext(ctx, "GET", fmt.Sprintf(
			"%s?module=logs&action=getLogs&fromBlock=%s&toBlock=%s&topic0=%s",
			api, from, to, topic0), nil)
	} else {
		req, err = http.NewRequestWithContext(ctx, "GET", fmt.Sprintf(
			"%s?module=logs&action=getLogs&fromBlock=%s&toBlock=%s&address=%s&topic0=%s&apikey=%s",
			api, from, to, contract, topic0, key), nil)
	}
	if err != nil {
		panic(err)
	}

	resp, err := c.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get logs: %w", err)
	}

	defer resp.Body.Close()

	var r LogResponse

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK && showErr {
		fmt.Println(string(body))
	}

	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if r.Status != "1" && r.Message != "No records found" {
		var e string
		_ = json.Unmarshal(r.Result, &e)
		return nil, fmt.Errorf("failed to get logs (%s): %s", r.Message, e)
	}

	var logs []*LogEntry
	if err := json.Unmarshal(r.Result, &logs); err != nil {
		return nil, fmt.Errorf("failed to unmarshal log entry: %w", err)
	}

	if chainId == vaa.ChainIDOasis || chainId == vaa.ChainIDAurora {
		// Because of a bug in BlockScout based explorers we need to check the address
		// in the log to see if it is the core bridge
		var filtered []*LogEntry
		for _, logLine := range logs {
			// Check value of address in log
			if logLine.Address == contract {
				filtered = append(filtered, logLine)
			}
		}
		logs = filtered
	}

	return logs, nil
}

type MissingMessages map[eth_common.Address /* emitter */]map[uint64 /* seq num */][]byte

func FindMissingMessages(ctx context.Context, admin nodev1.NodePrivilegedServiceClient, chainID vaa.ChainID) (missingMessages MissingMessages, err error) {
	missingMessages = make(MissingMessages)

	for _, emitter := range common.KnownEmitters {
		if emitter.ChainID != chainID {
			continue
		}

		contract := eth_common.HexToAddress(emitter.Emitter)

		msg := nodev1.FindMissingMessagesRequest{
			EmitterChain:   uint32(chainID),
			EmitterAddress: emitter.Emitter,
			RpcBackfill:    true,
			BackfillNodes:  common.PublicRPCEndpoints,
		}
		var resp *nodev1.FindMissingMessagesResponse
		resp, err = admin.FindMissingMessages(ctx, &msg)
		if err != nil {
			return
		}

		msgs := make([]*db.VAAID, len(resp.MissingMessages))
		for i, id := range resp.MissingMessages {
			fmt.Println(id)
			var vId *db.VAAID
			vId, err = db.VaaIDFromString(id)
			if err != nil {
				return
			}
			msgs[i] = vId
		}

		if len(msgs) == 0 {
			continue
		}

		if _, ok := missingMessages[contract]; !ok {
			missingMessages[contract] = make(map[uint64][]byte)
		}
		for _, msg := range msgs {
			missingMessages[contract][msg.Sequence] = nil
		}
	}

	return
}