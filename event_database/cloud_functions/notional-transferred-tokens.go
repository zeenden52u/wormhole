// Package p contains an HTTP Cloud Function.
package p

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"cloud.google.com/go/bigtable"
)

type Notional float64

func (n Notional) MarshalJSON() ([]byte, error) {
	return []byte(strconv.FormatFloat(float64(n), 'f', 2, 64)), nil
}

type transferredToken struct {
	Symbol              string
	Name                string
	CoinGeckoId         string
	NotionalTransferred Notional
}

type transferredTokensResult struct {
	// date -> sourceChain -> targetChain -> tokenAddress -> transferredToken
	TransferredTokens  map[string]map[string]map[string]map[string]transferredToken
	PeriodDurationDays int
}

// an in-memory cache of previously calculated results
var warmTransferredTokensCache = map[string]map[string]map[string]map[string]transferredToken{}
var muWarmTransferredTokensCache sync.RWMutex
var warmTransferredTokensCacheFilePath = "notional-transferred-tokens.json"

// finds the total amount of each token transferred from each chain, to each chain,
// from the specified start to the present.
func createTransferredTokensOfInterval(tbl *bigtable.Table, ctx context.Context, prefix string, start time.Time) {
	if len(warmTransferredTokensCache) == 0 {
		loadJsonToInterface(ctx, warmTransferredTokensCacheFilePath, &muWarmTransferredTokensCache, &warmTransferredTokensCache)
	}

	now := time.Now().UTC()
	numPrevDays := int(now.Sub(start).Hours() / 24)

	var intervalsWG sync.WaitGroup
	// there will be a query for each previous day, plus today
	intervalsWG.Add(numPrevDays + 1)

	for daysAgo := 0; daysAgo <= numPrevDays; daysAgo++ {
		go func(tbl *bigtable.Table, ctx context.Context, prefix string, daysAgo int) {
			defer intervalsWG.Done()
			// start is the SOD, end is EOD
			// "0 daysAgo start" is 00:00:00 AM of the current day
			// "0 daysAgo end" is 23:59:59 of the current day (the future)

			// calculate the start and end times for the query
			hoursAgo := (24 * daysAgo)
			daysAgoDuration := -time.Duration(hoursAgo) * time.Hour
			n := now.Add(daysAgoDuration)
			year := n.Year()
			month := n.Month()
			day := n.Day()
			loc := n.Location()

			start := time.Date(year, month, day, 0, 0, 0, 0, loc)
			end := time.Date(year, month, day, 23, 59, 59, maxNano, loc)

			dateStr := start.Format("2006-01-02")

			muWarmTransferredTokensCache.RLock()
			// check to see if there is cache data for this date/query
			if _, ok := warmTransferredTokensCache[dateStr]; ok && useCache(dateStr) {
				// have a cache for this date
				// only use the cache for yesterday and older
				if daysAgo >= 1 {
					// transferredTokens[dateStr] = dataCache
					muWarmTransferredTokensCache.RUnlock()
					return
				}
			}
			muWarmTransferredTokensCache.RUnlock()

			queryResult := fetchTransferRowsInInterval(tbl, ctx, prefix, start, end)

			transfers := map[string]map[string]map[string]transferredToken{}

			// iterate through the rows and increment the amounts
			for _, row := range queryResult {
				if _, ok := tokensToSkip[row.TokenAddress]; ok {
					// skip blacklisted token
					continue
				}
				if _, ok := transfers[row.LeavingChain]; !ok {
					transfers[row.LeavingChain] = map[string]map[string]transferredToken{}
				}
				if _, ok := transfers[row.LeavingChain][row.DestinationChain]; !ok {
					transfers[row.LeavingChain][row.DestinationChain] = map[string]transferredToken{}
				}
				if entry, ok := transfers[row.LeavingChain][row.DestinationChain][row.TokenAddress]; !ok {
					transfers[row.LeavingChain][row.DestinationChain][row.TokenAddress] = transferredToken{
						Symbol:              row.TokenSymbol,
						Name:                row.TokenName,
						CoinGeckoId:         row.CoinGeckoCoinId,
						NotionalTransferred: Notional(row.Notional),
					}
				} else {
					entry.NotionalTransferred += Notional(row.Notional)
					transfers[row.LeavingChain][row.DestinationChain][row.TokenAddress] = entry
				}
			}

			muWarmTransferredTokensCache.Lock()
			warmTransferredTokensCache[dateStr] = transfers
			log.Println("set " + dateStr)
			muWarmTransferredTokensCache.Unlock()
		}(tbl, ctx, prefix, daysAgo)
	}

	intervalsWG.Wait()

	persistInterfaceToJson(ctx, warmTransferredTokensCacheFilePath, &muWarmTransferredTokensCache, warmTransferredTokensCache)

	//// total the notional transferred for each token across all dates
	//totals := map[string]map[string]map[string]transferredToken{}
	//for _, leavingChains := range transferredTokens {
	//	for leavingChain, destChains := range leavingChains {
	//		if _, ok := totals[leavingChain]; !ok {
	//			totals[leavingChain] = map[string]map[string]transferredToken{}
	//		}
	//		for destChain, tokens := range destChains {
	//			if _, ok := totals[leavingChain][destChain]; !ok {
	//				totals[leavingChain][destChain] = map[string]transferredToken{}
	//			}
	//			for tokenAddress, token := range tokens {
	//				if entry, ok := totals[leavingChain][destChain][tokenAddress]; !ok {
	//					totals[leavingChain][destChain][tokenAddress] = token
	//				} else {
	//					entry.NotionalTransferred += token.NotionalTransferred
	//					totals[leavingChain][destChain][tokenAddress] = entry
	//				}
	//			}
	//		}
	//	}
	//}

	//return totals
}

// finds the value that has been transferred from each chain to each other, by token address.
func NotionalTransferredTokens(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Max-Age", "3600")
		w.WriteHeader(http.StatusNoContent)
		return
	}

	var numDays, allTime string

	// allow GET requests with querystring params, or POST requests with json body.
	switch r.Method {
	case http.MethodGet:
		queryParams := r.URL.Query()
		numDays = queryParams.Get("numDays")
		allTime = queryParams.Get("allTime")

	case http.MethodPost:
		// declare request body properties
		var d struct {
			NumDays string `json:"numDays"`
			AllTime string `json:"allTime"`
		}

		// deserialize request body
		if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
			switch err {
			case io.EOF:
				// do nothing, empty body is ok
			default:
				log.Printf("json.NewDecoder: %v", err)
				http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
				return
			}
		}

		numDays = d.NumDays
		allTime = d.AllTime

	default:
		http.Error(w, "405 - Method Not Allowed", http.StatusMethodNotAllowed)
		log.Println("Method Not Allowed")
		return
	}

	var queryDays int
	if allTime != "" {
		queryDays = int(time.Now().UTC().Sub(releaseDay).Hours() / 24)
	} else if numDays != "" {
		var convErr error
		queryDays, convErr = strconv.Atoi(numDays)
		if convErr != nil {
			fmt.Fprint(w, "numDays must be an integer")
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}
	} else {
		queryDays = 30
	}

	ctx, cancel := context.WithTimeout(context.Background(), 6000*time.Second)
	defer cancel()

	hours := (24 * queryDays)
	periodInterval := -time.Duration(hours) * time.Hour

	prev := time.Now().UTC().Add(periodInterval)
	start := time.Date(prev.Year(), prev.Month(), prev.Day(), 0, 0, 0, 0, prev.Location())

	createTransferredTokensOfInterval(tbl, ctx, "", start)

	result := transferredTokensResult{
		TransferredTokens:  warmTransferredTokensCache,
		PeriodDurationDays: queryDays,
	}

	jsonBytes, err := json.Marshal(result)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(err.Error()))
		log.Println(err.Error())
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Write(jsonBytes)
}
