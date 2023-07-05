package main

import (
	"context"
	"crypto/tls"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"

	wasmdtypes "github.com/CosmWasm/wasmd/x/wasm/types"
)

func main() {

	ctx := context.Background()
	config := &tls.Config{}
	conn, err := grpc.DialContext(ctx, "wormchain-rpc.quickapi.com:26657", grpc.WithTransportCredentials(credentials.NewTLS(config)))

	// query := `{"all_pending_transfers":{}}`
	query := fmt.Sprintf(`{"missing_observations":{"guardian_set": %d, "index": %d}}`, 2, 0)
	fmt.Println("query: ", query)

	req := wasmdtypes.QuerySmartContractStateRequest{Address: "wormhole14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9srrg465", QueryData: []byte(query)}
	fmt.Println((req))
	qc := wasmdtypes.NewQueryClient(conn)
	if qc == nil {
		fmt.Println("failed to create query client")
		return
	}

	resp, err := qc.SmartContractState(ctx, &req)
	if err != nil {
		fmt.Println("SmartContractState error", err)
		return
	}
	fmt.Println(resp)

}
