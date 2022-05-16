// Package p contains an HTTP Cloud Function.
package p

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sort"
	"strconv"
	"sync"
	"time"
)

type NotionalValue float64

func (n NotionalValue) MarshalJSON() ([]byte, error) {
	return []byte(strconv.FormatFloat(float64(n), 'f', 2, 64)), nil
}

type tokenTransfer struct {
	Symbol                     string
	Name                       string
	CoinGeckoId                string
	TokenAddress               string
	NotionalTransferred        NotionalValue
	NotionalTransferredToChain map[string]NotionalValue
}

type tokenTransfers struct {
	NotionalTransferred NotionalValue
	Transfers           map[string]tokenTransfer
}

// time period -> source chain -> tokenTransfers
type tokenTransfersByPeriod = map[string]map[string]tokenTransfers

type timePeriod struct {
	Name      string
	StartDate string
}

func subtractDate(t time.Time, years int, months int, days int) string {
	return t.AddDate(-years, -months, -days).Format("2006-01-02")
}

func getTimePeriods(now time.Time) []timePeriod {
	return []timePeriod{
		{"All time", releaseDay.Format("2006-01-02")},
		{"7 days", subtractDate(now, 0, 0, 7)},
		{"30 days", subtractDate(now, 0, 0, 30)},
		{"3 months", subtractDate(now, 0, 3, 0)},
		{"6 months", subtractDate(now, 0, 6, 0)},
		{"1 year", subtractDate(now, 1, 0, 0)}}
}

// date -> source chain -> token address -> tokenTransfer
var tokenTransfersCache = map[string]map[string]map[string]tokenTransfer{}
var tokenTransfersMutex sync.RWMutex
var tokenTransfersFileName = "token-transfers.json"
var tokenTransfersByPeriodFileName = "token-transfers-by-period.json"

// gets all of the tokens transferred for each day since releaseDay,
// writes the daily totals to the token-transfers.json cache file if necessary,
// then totals each tokens' notional transferred during each period and writes them to the token-transfers-by-period.json file
func computeTokenTransfers(ctx context.Context) {
	if len(tokenTransfersCache) == 0 {
		loadJsonToInterface(ctx, tokenTransfersFileName, &tokenTransfersMutex, &tokenTransfersCache)
	}

	now := time.Now().UTC()
	numPrevDays := int(now.Sub(releaseDay).Hours() / 24)

	var intervalsWG sync.WaitGroup
	// there will be a query for each previous day, plus today
	intervalsWG.Add(numPrevDays + 1)

	cacheNeedsUpdate := false

	for daysAgo := 0; daysAgo <= numPrevDays; daysAgo++ {
		go func(daysAgo int) {
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

			// only use the cache for yesterday and older (always recompute today's data)
			if daysAgo >= 1 {
				tokenTransfersMutex.RLock()
				// check to see if there is cache data for this date
				if _, ok := tokenTransfersCache[dateStr]; ok && useCache(dateStr) {
					// have cache data for this date
					tokenTransfersMutex.RUnlock()
					return
				}
				tokenTransfersMutex.RUnlock()
			}

			transfers := map[string]map[string]tokenTransfer{}

			queryResult := fetchTransferRowsInInterval(tbl, ctx, "", start, end)

			// iterate through the rows and increment the amounts
			for _, row := range queryResult {
				if _, ok := tokensToSkip[row.TokenAddress]; ok {
					// skip blacklisted token
					continue
				}
				if row.LeavingChain == row.DestinationChain {
					// TODO: why do these transfers to same chain exist?
					continue
				}
				if _, ok := transfers[row.LeavingChain]; !ok {
					transfers[row.LeavingChain] = map[string]tokenTransfer{}
				}
				if _, ok := transfers[row.LeavingChain][row.TokenAddress]; !ok {
					transfers[row.LeavingChain][row.TokenAddress] = tokenTransfer{
						Symbol:                     row.TokenSymbol,
						Name:                       row.TokenName,
						CoinGeckoId:                row.CoinGeckoCoinId,
						TokenAddress:               row.TokenAddress,
						NotionalTransferredToChain: map[string]NotionalValue{},
					}
				}
				transfers[row.LeavingChain][row.TokenAddress].NotionalTransferredToChain[row.DestinationChain] += NotionalValue(row.Notional)
			}

			tokenTransfersMutex.Lock()
			// cache data for yesterday and older
			if daysAgo >= 1 || !useCache(dateStr) {
				tokenTransfersCache[dateStr] = transfers
				cacheNeedsUpdate = true
			}
			tokenTransfersMutex.Unlock()
		}(daysAgo)
	}

	intervalsWG.Wait()

	if cacheNeedsUpdate {
		persistInterfaceToJson(ctx, tokenTransfersFileName, &tokenTransfersMutex, tokenTransfersCache)
	}

	// compute the total notional transferred to each chain over each time period
	timePeriods := getTimePeriods(now)
	periodTransfers := tokenTransfersByPeriod{}
	periodTopTransfers := tokenTransfersByPeriod{}
	for _, timePeriod := range timePeriods {
		periodTransfers[timePeriod.Name] = map[string]tokenTransfers{}
		for date, leavingChains := range tokenTransfersCache {
			if date >= timePeriod.StartDate {
				for leavingChain, transfersByAddress := range leavingChains {
					if _, ok := periodTransfers[timePeriod.Name][leavingChain]; !ok {
						periodTransfers[timePeriod.Name][leavingChain] = tokenTransfers{
							Transfers: map[string]tokenTransfer{},
						}
					}
					for address, transfer := range transfersByAddress {
						if _, ok := periodTransfers[timePeriod.Name][leavingChain].Transfers[address]; !ok {
							periodTransfers[timePeriod.Name][leavingChain].Transfers[address] = tokenTransfer{
								Symbol:                     transfer.Symbol,
								Name:                       transfer.Name,
								CoinGeckoId:                transfer.CoinGeckoId,
								TokenAddress:               transfer.TokenAddress,
								NotionalTransferredToChain: map[string]NotionalValue{},
							}
						}
						addressTotals := periodTransfers[timePeriod.Name][leavingChain].Transfers[address]
						// chainTotals := periodTransfers[timePeriod.Name][leavingChain]
						for destChainId, notional := range transfer.NotionalTransferredToChain {
							addressTotals.NotionalTransferredToChain[destChainId] += notional
							addressTotals.NotionalTransferred += notional
							// chainTotals.NotionalTransferred += notional
						}
						periodTransfers[timePeriod.Name][leavingChain].Transfers[address] = addressTotals
						// periodTransfers[timePeriod.Name][leavingChain] = chainTotals
					}
				}
			}
		}
		// store all of the address totals for this chain in a list
		periodTopTransfers[timePeriod.Name] = map[string]tokenTransfers{}
		for leavingChain, transfers := range periodTransfers[timePeriod.Name] {
			var transfersArray []tokenTransfer
			for _, transfer := range transfers.Transfers {
				transfersArray = append(transfersArray, transfer)
			}
			// sort them by notional transferred
			sort.Slice(transfersArray, func(i, j int) bool {
				return transfersArray[i].NotionalTransferred > transfersArray[j].NotionalTransferred
			})
			topTransfers := tokenTransfers{
				Transfers: map[string]tokenTransfer{},
			}
			for i := 0; i < 10 && i < len(transfersArray); i++ {
				topTransfers.Transfers[transfersArray[i].TokenAddress] = transfersArray[i]
				topTransfers.NotionalTransferred += transfersArray[i].NotionalTransferred
			}
			periodTopTransfers[timePeriod.Name][leavingChain] = topTransfers
		}

	}
	persistInterfaceToJson(ctx, tokenTransfersByPeriodFileName, &tokenTransfersMutex, periodTopTransfers)
}

func ComputeTokenTransfers(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Max-Age", "3600")
		w.WriteHeader(http.StatusNoContent)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 6000*time.Second)
	defer cancel()

	computeTokenTransfers(ctx)
	TokenTransfers(w, r)
}

func TokenTransfers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Methods", "POST")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Max-Age", "3600")
		w.WriteHeader(http.StatusNoContent)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	var transfers tokenTransfersByPeriod
	loadJsonToInterface(ctx, tokenTransfersByPeriodFileName, &tokenTransfersMutex, &transfers)
	jsonBytes, err := json.Marshal(transfers)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(err.Error()))
		log.Println(err.Error())
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Write(jsonBytes)
}
