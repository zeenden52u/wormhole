package payloads

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"

	"github.com/wormhole-foundation/wormhole/sdk/vaa"
)

type TokenTransfer struct {
	Amount         Amount
	TokenAddress   vaa.Address
	TokenChain     vaa.ChainID
	Recipient      vaa.Address
	RecipientChain vaa.ChainID
	Fee            Amount
}

func (t *TokenTransfer) UnmarshalBinary(data []byte) error {
	if len(data) != 132 {
		return fmt.Errorf("invalid data length; want 132 bytes, got %d", len(data))
	}

	r := bytes.NewReader(data)
	if err := readAmount(r, &t.Amount); err != nil {
		return fmt.Errorf("failed to read Amount: %w", err)
	}
	if err := mustRead(r, t.TokenAddress[:]); err != nil {
		return fmt.Errorf("failed to read TokenAddress: %w", err)
	}
	if err := binary.Read(r, binary.BigEndian, &t.TokenChain); err != nil {
		return fmt.Errorf("failed to read TokenChain: %w", err)
	}
	if err := mustRead(r, t.Recipient[:]); err != nil {
		return fmt.Errorf("failed to read Recipient: %w", err)
	}
	if err := binary.Read(r, binary.BigEndian, &t.RecipientChain); err != nil {
		return fmt.Errorf("failed to read RecipientChain: %w", err)
	}
	if err := readAmount(r, &t.Fee); err != nil {
		return fmt.Errorf("failed to read Fee: %w", err)
	}
	return nil
}

type TokenTransferWithPayload struct {
	Amount         Amount
	TokenAddress   vaa.Address
	TokenChain     vaa.ChainID
	Recipient      vaa.Address
	RecipientChain vaa.ChainID
	Sender         vaa.Address
	Payload        []byte
}

func (t *TokenTransferWithPayload) UnmarshalBinary(data []byte) error {
	if len(data) < 132 {
		return fmt.Errorf("invalid data length; want at least 132 bytes, got %d", len(data))
	}

	r := bytes.NewReader(data)
	if err := readAmount(r, &t.Amount); err != nil {
		return fmt.Errorf("failed to read Amount: %w", err)
	}
	if err := mustRead(r, t.TokenAddress[:]); err != nil {
		return fmt.Errorf("failed to read TokenAddress: %w", err)
	}
	if err := binary.Read(r, binary.BigEndian, &t.TokenChain); err != nil {
		return fmt.Errorf("failed to read TokenChain: %w", err)
	}
	if err := mustRead(r, t.Recipient[:]); err != nil {
		return fmt.Errorf("failed to read Recipient: %w", err)
	}
	if err := binary.Read(r, binary.BigEndian, &t.RecipientChain); err != nil {
		return fmt.Errorf("failed to read RecipientChain: %w", err)
	}
	if err := mustRead(r, t.Sender[:]); err != nil {
		return fmt.Errorf("failed to read Sender: %w", err)
	}

	t.Payload = make([]byte, r.Len())
	if err := mustRead(r, t.Payload); err != nil {
		return fmt.Errorf("failed to read Sender: %w", err)
	}

	return nil
}

type AssetMeta struct {
	TokenAddress vaa.Address
	TokenChain   vaa.ChainID
	Decimals     uint8
	Symbol       string
	Name         string
}

func (a *AssetMeta) UnmarshalBinary(data []byte) error {
	if len(data) != 99 {
		return fmt.Errorf("invalid data length; want 99 bytes, got %d", len(data))
	}

	r := bytes.NewReader(data)
	if err := mustRead(r, a.TokenAddress[:]); err != nil {
		return fmt.Errorf("failed to read TokenAddress: %w", err)
	}
	if err := binary.Read(r, binary.BigEndian, &a.TokenChain); err != nil {
		return fmt.Errorf("failed to read TokenChain: %w", err)
	}

	// This can never fail because we already checked the length of the input data above.
	a.Decimals, _ = r.ReadByte()

	symbol := [32]byte{}
	if err := mustRead(r, symbol[:]); err != nil {
		return fmt.Errorf("failed to read Symbol: %w", err)
	}
	a.Symbol = string(symbol[:])

	name := [32]byte{}
	if err := mustRead(r, name[:]); err != nil {
		return fmt.Errorf("failed to read Name: %w", err)
	}
	a.Name = string(name[:])

	return nil
}

type TokenMessage struct {
	Transfer            *TokenTransfer            `json:",omitempty"`
	AssetMeta           *AssetMeta                `json:",omitempty"`
	TransferWithPayload *TokenTransferWithPayload `json:",omitempty"`
}

func (m *TokenMessage) UnmarshalBinary(data []byte) error {
	if len(data) < 1 {
		return errors.New("empty data")
	}

	switch data[0] {
	case 1:
		t := new(TokenTransfer)
		if err := t.UnmarshalBinary(data[1:]); err != nil {
			return fmt.Errorf("failed to unmarshal TokenTransfer: %w", err)
		}

		m.Transfer = t
		return nil
	case 2:
		a := new(AssetMeta)
		if err := a.UnmarshalBinary(data[1:]); err != nil {
			return fmt.Errorf("failed to unmarshal TokenTransfer: %w", err)
		}

		m.AssetMeta = a
		return nil
	case 3:
		t := new(TokenTransferWithPayload)
		if err := t.UnmarshalBinary(data[1:]); err != nil {
			return fmt.Errorf("failed to unmarshal TokenTransferWithPayload: %w", err)
		}

		m.TransferWithPayload = t
		return nil
	default:
		return fmt.Errorf("Unknown payload type: %d", data[0])
	}
}
