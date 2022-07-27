package vaa

import (
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestAddSdnEntry(t *testing.T) {
	addr1, _ := StringToAddress("0000000000000000000000000290FB167208Af455bB137780163b7B7a9a10C16")
	chain1 := ChainIDEthereum

	sdl := SdnList{}
	assert.Equal(t, 0, len(sdl.list))

	SanctionedSe := SdnEntry{chainID: chain1, addr: addr1}
	sdl.AddSdnEntry(SanctionedSe)
	assert.Equal(t, 1, len(sdl.list))

}

func TestSanctioned(t *testing.T) {
	addr1, _ := StringToAddress("0000000000000000000000000290FB167208Af455bB137780163b7B7a9a10C16")
	chain1 := ChainIDEthereum

	addr2, _ := StringToAddress("0000000000000000000000000290FB167208Af455bB137780163b7B7a9a10C15")
	chain2 := ChainIDEthereum

	sdl := SdnList{}

	// Before the entry is added
	assert.Equal(t, false, sdl.Sanctioned(chain1, addr1))
	assert.Equal(t, false, sdl.Sanctioned(chain2, addr2))

	// After the entry is added
	SanctionedSe := SdnEntry{chainID: chain1, addr: addr1}
	sdl.AddSdnEntry(SanctionedSe)
	assert.Equal(t, true, sdl.Sanctioned(chain1, addr1))
	assert.Equal(t, false, sdl.Sanctioned(chain2, addr2))
}
