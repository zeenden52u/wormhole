package vaa

import (
	"time"
)

type (
	SdnEntry struct {
		chainID ChainID
		addr    Address
	}

	SdnList struct {
		timestamp time.Time
		list      []SdnEntry
	}
)

func (sdl *SdnList) Update(se SdnEntry) {
	// TODO: go to treasury website and parse the raw SDL list
	// we can use the SdnList timestamp to determine if it needs to be updated on the fly on some interval)
}

func (sdl *SdnList) AddSdnEntry(se SdnEntry) []SdnEntry {
	sdl.list = append(sdl.list, se)
	return sdl.list
}

func (sdl SdnList) Sanctioned(chain ChainID, addr Address) bool {
	for _, se := range sdl.list {
		if se.chainID == chain && se.addr == addr {
			return true
		}
	}

	return false
}
