package guardiand

import (
	"context"
	"encoding/hex"
	"fmt"
	"os"
	"encoding/json"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/ethereum"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	publicrpcv1 "github.com/certusone/wormhole/node/pkg/proto/publicrpc/v1"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"github.com/davecgh/go-spew/spew"
	"github.com/spf13/pflag"
	"io/ioutil"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/status-im/keycard-go/hexutils"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/encoding/prototext"

	nodev1 "github.com/certusone/wormhole/node/pkg/proto/node/v1"
)

var (
	clientSocketPath *string
	shouldBackfill   *bool
)

func init() {
	// Shared flags for all admin commands
	pf := pflag.NewFlagSet("commonAdminFlags", pflag.ContinueOnError)
	clientSocketPath = pf.String("socket", "", "gRPC admin server socket to connect to")
	err := cobra.MarkFlagRequired(pf, "socket")
	if err != nil {
		panic(err)
	}

	shouldBackfill = AdminClientFindMissingMessagesCmd.Flags().Bool(
		"backfill", false, "backfill missing VAAs from public RPC")

	AdminClientInjectGuardianSetUpdateCmd.Flags().AddFlagSet(pf)
	AdminClientFindMissingMessagesCmd.Flags().AddFlagSet(pf)
	AdminClientFindAllMissingMessagesCmd.Flags().AddFlagSet(pf)
	AdminClientListNodes.Flags().AddFlagSet(pf)
	DumpVAAByMessageID.Flags().AddFlagSet(pf)
	SendObservationRequest.Flags().AddFlagSet(pf)

	AdminCmd.AddCommand(AdminClientInjectGuardianSetUpdateCmd)
	AdminCmd.AddCommand(AdminClientFindMissingMessagesCmd)
	AdminCmd.AddCommand(AdminClientFindAllMissingMessagesCmd)
	AdminCmd.AddCommand(AdminClientGovernanceVAAVerifyCmd)
	AdminCmd.AddCommand(AdminClientListNodes)
	AdminCmd.AddCommand(DumpVAAByMessageID)
	AdminCmd.AddCommand(SendObservationRequest)
}

var AdminCmd = &cobra.Command{
	Use:   "admin",
	Short: "Guardian node admin commands",
}

var AdminClientInjectGuardianSetUpdateCmd = &cobra.Command{
	Use:   "governance-vaa-inject [FILENAME]",
	Short: "Inject and sign a governance VAA from a prototxt file (see docs!)",
	Run:   runInjectGovernanceVAA,
	Args:  cobra.ExactArgs(1),
}

var AdminClientFindMissingMessagesCmd = &cobra.Command{
	Use:   "find-missing-messages [CHAIN_ID] [EMITTER_ADDRESS_HEX]",
	Short: "Find sequence number gaps for the given chain ID and emitter address",
	Run:   runFindMissingMessages,
	Args:  cobra.ExactArgs(2),
}

var AdminClientFindAllMissingMessagesCmd = &cobra.Command{
	Use:   "find-all-missing-messages [mode] [apiKeyFile]",
	Short: "Find sequence number gaps for all mainnet chain IDs and emitters, [mode] should be either \"logonly\" or \"recover\"",
	Run:   runFindAllMissingMessages,
	Args:  cobra.ExactArgs(2),
}

var DumpVAAByMessageID = &cobra.Command{
	Use:   "dump-vaa-by-message-id [MESSAGE_ID]",
	Short: "Retrieve a VAA by message ID (chain/emitter/seq) and decode and dump the VAA",
	Run:   runDumpVAAByMessageID,
	Args:  cobra.ExactArgs(1),
}

var SendObservationRequest = &cobra.Command{
	Use:   "send-observation-request [CHAIN_ID] [TX_HASH_HEX]",
	Short: "Broadcast an observation request for the given chain ID and chain-specific tx_hash",
	Run:   runSendObservationRequest,
	Args:  cobra.ExactArgs(2),
}

func getAdminClient(ctx context.Context, addr string) (*grpc.ClientConn, error, nodev1.NodePrivilegedServiceClient) {
	conn, err := grpc.DialContext(ctx, fmt.Sprintf("unix:///%s", addr), grpc.WithInsecure())

	if err != nil {
		log.Fatalf("failed to connect to %s: %v", addr, err)
	}

	c := nodev1.NewNodePrivilegedServiceClient(conn)
	return conn, err, c
}

func getPublicRPCServiceClient(ctx context.Context, addr string) (*grpc.ClientConn, error, publicrpcv1.PublicRPCServiceClient) {
	conn, err := grpc.DialContext(ctx, fmt.Sprintf("unix:///%s", addr), grpc.WithInsecure())

	if err != nil {
		log.Fatalf("failed to connect to %s: %v", addr, err)
	}

	c := publicrpcv1.NewPublicRPCServiceClient(conn)
	return conn, err, c
}

func runInjectGovernanceVAA(cmd *cobra.Command, args []string) {
	path := args[0]
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err, c := getAdminClient(ctx, *clientSocketPath)
	defer conn.Close()
	if err != nil {
		log.Fatalf("failed to get admin client: %v", err)
	}

	b, err := ioutil.ReadFile(path)
	if err != nil {
		log.Fatalf("failed to read file: %v", err)
	}

	var msg nodev1.InjectGovernanceVAARequest
	err = prototext.Unmarshal(b, &msg)
	if err != nil {
		log.Fatalf("failed to deserialize: %v", err)
	}

	resp, err := c.InjectGovernanceVAA(ctx, &msg)
	if err != nil {
		log.Fatalf("failed to submit governance VAA: %v", err)
	}

	for _, digest := range resp.Digests {
		log.Printf("VAA successfully injected with digest %s", hexutils.BytesToHex(digest))
	}
}

func runFindMissingMessages(cmd *cobra.Command, args []string) {
	chainID, err := strconv.Atoi(args[0])
	if err != nil {
		log.Fatalf("invalid chain ID: %v", err)
	}
	emitterAddress := args[1]

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	conn, err, c := getAdminClient(ctx, *clientSocketPath)
	defer conn.Close()
	if err != nil {
		log.Fatalf("failed to get admin client: %v", err)
	}

	msg := nodev1.FindMissingMessagesRequest{
		EmitterChain:   uint32(chainID),
		EmitterAddress: emitterAddress,
		RpcBackfill:    *shouldBackfill,
		BackfillNodes:  common.PublicRPCEndpoints,
	}
	resp, err := c.FindMissingMessages(ctx, &msg)
	if err != nil {
		log.Fatalf("failed to run find FindMissingMessages RPC: %v", err)
	}

	for _, id := range resp.MissingMessages {
		fmt.Println(id)
	}

	log.Printf("processed %s sequences %d to %d (%d gaps)",
		emitterAddress, resp.FirstSequence, resp.LastSequence, len(resp.MissingMessages))
}

type ApiKeys struct {
    ApiKeys []ApiKey `json:"api_keys"`
}

type ApiKey struct {
    Chain   string `json:"chain"`
    ApiKey   string `json:"api_key"`
}

// kubectl cp /home/briley/apiKeys.json guardian-0:/tmp

func runFindAllMissingMessages(cmd *cobra.Command, args []string) {
	mode := strings.ToLower(args[0])
	logOnly := false
	if mode == "logonly" {
		logOnly = true
	} else if mode != "recover" {
		log.Fatalf("invalid mode, must be \"logonly\" or \"recover\", is: %s", mode)
	}

	// Load our file of API keys.
	apiKeyFileName := args[1]
	jsonFile, err := os.Open(apiKeyFileName)
	if err != nil {
		fmt.Println(err)
		log.Fatalf("failed to open api keys file [%s]: %v", apiKeyFileName, err)
	}
	defer jsonFile.Close()

	// read our opened jsonFile as a byte array.
	byteValue, _ := ioutil.ReadAll(jsonFile)

	var apiKeys ApiKeys
	json.Unmarshal(byteValue, &apiKeys)

	var apiKeysMap map[vaa.ChainID] string = make(map[vaa.ChainID] string)
	for i := 0; i < len(apiKeys.ApiKeys); i++ {
		chainID, err := vaa.ChainIDFromString(apiKeys.ApiKeys[i].Chain)
		if err != nil {
			continue
		}	
		apiKeysMap[chainID] = apiKeys.ApiKeys[i].ApiKey
	}

	if logOnly {
		log.Printf("looking for missing messages and log them")
	} else {
		log.Printf("looking for missing messages and attempt to recover them")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	conn, err, c := getAdminClient(ctx, *clientSocketPath)
	defer conn.Close()
	if err != nil {
		log.Fatalf("failed to get admin client: %v", err)
	}

	type MissingMessageEntry struct {
		chainID vaa.ChainID
		missingMessages ethereum.MissingMessages
	}

	var missingMessages []MissingMessageEntry

	// Go through all of our emitters and find any missing messages for each one.
	for _, e := range common.KnownEmitters {
		mm, err := ethereum.FindMissingMessages(ctx, c, e.ChainID);
		if err != nil {
			log.Fatalf("failed to find missing messages for chainID %v, emitter %s: %v", e.ChainID, e.Emitter, err)
		}

		if len(mm) != 0 {
			missingMessages = append(missingMessages, MissingMessageEntry{e.ChainID, mm})
		}	
	}

	if len(missingMessages) == 0 {
		log.Printf("did not find any missing messages")
		return
	}

	// Before we can send observation requests, we need to generate the hash for each sequence number.
	// for _, mm := range missingMessages {
		// etherscanAPI, err := ethereum.EtherscanAPIMap[mm.chainID]
		// if err != nil {
		// 	log.Printf("chain %s does not support etherscan", mm.chainID)
		// 	continue
		// }

		// logs, err := ethereum.GetLogs(mm.chainID, ctx, c, etherscanAPI, *etherscanKey, coreContract, tokenLockupTopic.Hex(), from, to, *showError)
		// if err != nil {
		// 	log.Fatalf("failed to get logs: %v", err)
		// }

		// if len(logs) == 0 {
		// 	log.Printf("No logs found")
		// 	continue
		// }
	// }
}

// runDumpVAAByMessageID uses GetSignedVAA to request the given message,
// then decode and dump the VAA.
func runDumpVAAByMessageID(cmd *cobra.Command, args []string) {
	// Parse the {chain,emitter,seq} string.
	parts := strings.Split(args[0], "/")
	if len(parts) != 3 {
		log.Fatalf("invalid message ID: %s", args[0])
	}
	chainID, err := strconv.ParseUint(parts[0], 10, 32)
	if err != nil {
		log.Fatalf("invalid chain ID: %v", err)
	}
	emitterAddress := parts[1]
	seq, err := strconv.ParseUint(parts[2], 10, 64)
	if err != nil {
		log.Fatalf("invalid sequence number: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err, c := getPublicRPCServiceClient(ctx, *clientSocketPath)
	defer conn.Close()
	if err != nil {
		log.Fatalf("failed to get public RPC service client: %v", err)
	}

	msg := publicrpcv1.GetSignedVAARequest{
		MessageId: &publicrpcv1.MessageID{
			EmitterChain:   publicrpcv1.ChainID(chainID),
			EmitterAddress: emitterAddress,
			Sequence:       seq,
		},
	}
	resp, err := c.GetSignedVAA(ctx, &msg)
	if err != nil {
		log.Fatalf("failed to run GetSignedVAA RPC: %v", err)
	}

	v, err := vaa.Unmarshal(resp.VaaBytes)
	if err != nil {
		log.Fatalf("failed to decode VAA: %v", err)
	}

	log.Printf("VAA with digest %s: %+v\n", v.HexDigest(), spew.Sdump(v))
	fmt.Printf("Bytes:\n%s\n", hex.EncodeToString(resp.VaaBytes))
}

func runSendObservationRequest(cmd *cobra.Command, args []string) {
	chainID, err := strconv.Atoi(args[0])
	if err != nil {
		log.Fatalf("invalid chain ID: %v", err)
	}

	txHash, err := hex.DecodeString(args[1])
	if err != nil {
		log.Fatalf("invalid transaction hash: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err, c := getAdminClient(ctx, *clientSocketPath)
	defer conn.Close()
	if err != nil {
		log.Fatalf("failed to get admin client: %v", err)
	}

	_, err = c.SendObservationRequest(ctx, &nodev1.SendObservationRequestRequest{
		ObservationRequest: &gossipv1.ObservationRequest{
			ChainId: uint32(chainID),
			TxHash:  txHash,
		},
	})
	if err != nil {
		log.Fatalf("failed to send observation request: %v", err)
	}
}
