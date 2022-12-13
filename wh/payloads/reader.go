package payloads

import (
	"fmt"
	"io"
	"math/big"

	"github.com/holiman/uint256"
)

func mustRead(r io.Reader, b []byte) error {
	n, err := r.Read(b)
	if err != nil {
		return err
	}

	if n != len(b) {
		return fmt.Errorf("short read; want %d bytes, got %d bytes", len(b), n)
	}

	return nil
}

func readAmount(r io.Reader, amt *Amount) error {
	b := [32]byte{}
	if err := mustRead(r, b[:]); err != nil {
		return err
	}

	// We know the value is exactly 32 bytes so it can never overflow.
	a, _ := uint256.FromBig(big.NewInt(0).SetBytes(b[:]))

	*amt = Amount{a}

	return nil

}
