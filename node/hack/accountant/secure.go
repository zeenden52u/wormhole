package main

import (
	"context"
	"fmt"
	"reflect"

	tmHttp "github.com/tendermint/tendermint/rpc/client/http"
	tmTypes "github.com/tendermint/tendermint/types"
)

func main() {
	tmConn, err := tmHttp.New("https://wormchain-rpc.quickapi.com:443", "/websocket")
	if err != nil {
		fmt.Println("failed to establish tendermint connection: ", err)
	}
	fmt.Println("Connected")
	if err := tmConn.Start(); err != nil {
		fmt.Println("failed to start tendermint connection: ", err)
	}
	defer func() {
		if err := tmConn.Stop(); err != nil {
			fmt.Println("acctwatch: failed to stop tendermint connection", err)
		}
	}()
	fmt.Println("Started")

	query := fmt.Sprintf("execute._contract_address='%s'", "wormhole14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9srrg465")
	ctx := context.Background()
	events, err := tmConn.Subscribe(
		ctx,
		"guardiand",
		query,
		64, // channel capacity
	)
	if err != nil {
		fmt.Println("failed to subscribe to accountant events: %w", err)
	}
	defer func() {
		if err := tmConn.UnsubscribeAll(ctx, "guardiand"); err != nil {
			fmt.Println("acctwatch: failed to unsubscribe from events", err)
		}
	}()
	fmt.Println("Subscribed")

	for {
		select {
		case <-ctx.Done():
			return
		case e := <-events:
			fmt.Println("Received an event")
			tx, ok := e.Data.(tmTypes.EventDataTx)
			if !ok {
				fmt.Println("acctwatcher: unknown data from event subscription", reflect.TypeOf(e.Data), e)
				continue
			}

			for _, event := range tx.Result.Events {
				if event.Type == "wasm-Observation" {
					// evt, err := parseEvent[WasmObservation](acct.logger, event, "wasm-Observation", acct.contract)
					if err != nil {
						fmt.Println("acctwatcher: failed to parse wasm transfer event", err, reflect.TypeOf(e.Data), event)
						continue
					}

					fmt.Println("Event:", event)
					// } else if event.Type == "wasm-ObservationError" {
					// 	// evt, err := parseEvent[WasmObservationError](acct.logger, event, "wasm-ObservationError", acct.contract)
					// 	if err != nil {
					// 		fmt.Println("acctwatcher: failed to parse wasm observation error event", zap.Error(err), zap.Stringer("e.Data", reflect.TypeOf(e.Data)), zap.Any("event", event))
					// 		continue
					// 	}

					// 	errorEventsReceived.Inc()
					// 	acct.handleTransferError(evt.Key.String(), evt.Error, "acct: transfer error event received")
				} else {
					fmt.Println("acctwatcher: ignoring uninteresting event", event.Type)
				}
			}
		}
	}
}
