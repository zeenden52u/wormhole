/*
Copyright © 2022 Wormhole Project Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package cmd

import (
	"encoding/hex"
	"fmt"

	"cloud.google.com/go/bigtable"
	"github.com/spf13/cobra"
	tmdb "github.com/tendermint/tm-db"
	"github.com/wormhole-foundation/wormhole/sdk"
	"github.com/wormhole-foundation/wormhole/wh/payloads"
	"google.golang.org/api/option"
)

// fetchCmd represents the fetch command
var fetchCmd = &cobra.Command{
	Use:   "fetch-token-vaas",
	Short: "Fetch signed tokenbridge VAAs",
	Long: `
Fetches signed tokenbridge VAAs from the cloud database.
`,
	RunE: fetch,
}

var (
	project      *string
	instance     *string
	creds        *string
	table        *string
	fetchName    *string
	fetchBackend *string
	fetchDir     *string
)

func init() {
	project = fetchCmd.Flags().StringP("project", "p", "wormhole-315720", "Name of the GCP project.")
	instance = fetchCmd.Flags().StringP("instance", "i", "wormhole-mainnet", "Name of the BigTable instance.")
	creds = fetchCmd.Flags().StringP("creds", "c", "", "Path to the JSON credentials file.")
	table = fetchCmd.Flags().StringP("table", "t", "v2Events", "Name of the table.")
	fetchBackend = fetchCmd.Flags().StringP("backend", "b", "goleveldb", "Backend for the local db.")
	fetchName = fetchCmd.Flags().StringP("name", "n", "vaa", "Name of the local db.")
	fetchDir = fetchCmd.Flags().StringP("dir", "d", ".", "Directory of the local db.")

	rootCmd.AddCommand(fetchCmd)
}

func fetch(cmd *cobra.Command, args []string) error {
	var opts []option.ClientOption
	if *creds != "" {
		opts = append(opts, option.WithCredentialsFile(*creds))
	}

	db, err := tmdb.NewDB(*fetchName, tmdb.BackendType(*fetchBackend), *fetchDir)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer db.Close()

	client, err := bigtable.NewClient(cmd.Context(), *project, *instance, opts...)
	if err != nil {
		return fmt.Errorf("failed to create BigTable client: %w", err)
	}
	defer client.Close()

	rr := make(bigtable.RowRangeList, 0, len(sdk.KnownTokenbridgeEmitters))
	for chain, addr := range sdk.KnownTokenbridgeEmitters {
		rr = append(rr, bigtable.PrefixRange(fmt.Sprintf("%d:%s", chain, hex.EncodeToString(addr))))
	}

	readOpts := []bigtable.ReadOption{
		bigtable.RowFilter(bigtable.FamilyFilter("QuorumState")),
	}

	tbl := client.Open(*table)
	if err := tbl.ReadRows(cmd.Context(), rr, makeRowHandler(db), readOpts...); err != nil {
		return fmt.Errorf("failed to read rows: %w", err)
	}

	return nil
}

func makeRowHandler(db tmdb.DB) func(r bigtable.Row) bool {
	count := 0
	return func(r bigtable.Row) bool {
		for _, c := range r["QuorumState"] {
			var v payloads.Vaa[payloads.TokenMessage, *payloads.TokenMessage]

			if err := v.UnmarshalBinary(c.Value); err != nil {
				fmt.Printf("skipping VAA with key %s: %v\n", r.Key(), err)
				continue
			}

			key := fmt.Sprintf("%05d/%s/%016d", v.EmitterChain, v.EmitterAddress, v.Sequence)
			data := c.Value

			count += 1
			if count%10000 == 0 {
				fmt.Println(key)
			}

			if v, _ := db.Get([]byte(key)); v != nil {
				fmt.Printf("Found duplicate VAA for key %s\n", key)
			}

			if err := db.Set([]byte(key), data); err != nil {
				fmt.Printf("failed to set transfer for key %s: %v", key, err)
				return false
			}
		}
		return true
	}

}
