package payloads

import (
	"fmt"
	"math/big"

	"github.com/holiman/uint256"
)

// Amount embeds a `uint256.Int` but uses a different JSON encoding.
type Amount struct {
	*uint256.Int
}

func (a Amount) MarshalJSON() ([]byte, error) {
	return a.ToBig().MarshalJSON()
}

func (a Amount) UnmarshalJSON(data []byte) error {
	b := new(big.Int)
	if err := b.UnmarshalJSON(data); err != nil {
		return err
	}

	i, overflow := uint256.FromBig(b)
	if overflow {
		return fmt.Errorf("Value is too large to fit in `uint256.Int`: %d", b)
	}

	a.Int = i

	return nil
}
