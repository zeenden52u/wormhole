package payloads

import (
	"bytes"
	"encoding"
	"encoding/binary"
	"fmt"
	"io"
	"time"

	"github.com/wormhole-foundation/wormhole/sdk/vaa"
)

const minVAALength = 57

type Binary []byte

func (b *Binary) UnmarshalBinary(data []byte) error {
	*b = make([]byte, len(data))
	copy(*b, data)
	return nil
}

// I defines the interface for payloads.
//
// We want to be able to store the payload by value in the struct but implementing
// BinaryUnmarshaler requires a pointer receiver so we use this generic interface and require
// both the value and the pointer in the struct.  This pattern comes from the design doc for
// Go generics: https://go.googlesource.com/proposal/+/refs/heads/master/design/43651-type-parameters.md#pointer-method-example
type I[P any] interface {
	*P
	encoding.BinaryUnmarshaler
}

// Vaa is like vaa.VAA, except that it is generic over the payload type.
type Vaa[P any, PP I[P]] struct {
	// Version of the VAA schema
	Version uint8
	// GuardianSetIndex is the index of the guardian set that signed this VAA
	GuardianSetIndex uint32
	// SignatureData is the signature of the guardian set
	Signatures []*vaa.Signature

	// Timestamp when the VAA was created
	Timestamp time.Time
	// Nonce of the VAA
	Nonce uint32
	// EmitterChain the VAA was emitted on
	EmitterChain vaa.ChainID
	// EmitterAddress of the contract that emitted the Message
	EmitterAddress vaa.Address
	// Sequence of the VAA
	Sequence uint64
	// ConsistencyLevel of the VAA
	ConsistencyLevel uint8
	// Payload of the message
	Payload P
}

func NewVaa[P any, PP I[P]](v vaa.VAA) (Vaa[P, PP], error) {
	var p P
	if err := PP(&p).UnmarshalBinary(v.Payload); err != nil {
		return Vaa[P, PP]{}, fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	out := Vaa[P, PP]{
		Version:          v.Version,
		GuardianSetIndex: v.GuardianSetIndex,
		Signatures:       v.Signatures,

		Timestamp:        v.Timestamp,
		Nonce:            v.Nonce,
		Sequence:         v.Sequence,
		ConsistencyLevel: v.ConsistencyLevel,
		EmitterChain:     v.EmitterChain,
		EmitterAddress:   v.EmitterAddress,
		Payload:          p,
	}

	return out, nil
}

func (v *Vaa[P, PP]) UnmarshalBinary(data []byte) error {
	if len(data) < minVAALength {
		return fmt.Errorf("VAA is too short")
	}

	reader := bytes.NewReader(data)

	// This first read can never fail because we've already checked the length.
	v.Version, _ = reader.ReadByte()
	if v.Version != vaa.SupportedVAAVersion {
		return fmt.Errorf("unsupported VAA version: %d", v.Version)
	}

	if err := binary.Read(reader, binary.BigEndian, &v.GuardianSetIndex); err != nil {
		return fmt.Errorf("failed to read guardian set index: %w", err)
	}

	lenSignatures, er := reader.ReadByte()
	if er != nil {
		return fmt.Errorf("failed to read signature length")
	}

	v.Signatures = make([]*vaa.Signature, 0, lenSignatures)
	for i := 0; i < int(lenSignatures); i++ {
		s := new(vaa.Signature)
		if err := binary.Read(reader, binary.BigEndian, &s.Index); err != nil {
			return fmt.Errorf("failed to read validator index [%d]", i)
		}

		if err := mustRead(reader, s.Signature[:]); err != nil {
			return fmt.Errorf("failed to read signature [%d]: %w", i, err)
		}

		v.Signatures = append(v.Signatures, s)
	}

	unixSeconds := uint32(0)
	if err := binary.Read(reader, binary.BigEndian, &unixSeconds); err != nil {
		return fmt.Errorf("failed to read timestamp: %w", err)
	}
	v.Timestamp = time.Unix(int64(unixSeconds), 0)

	if err := binary.Read(reader, binary.BigEndian, &v.Nonce); err != nil {
		return fmt.Errorf("failed to read nonce: %w", err)
	}

	if err := binary.Read(reader, binary.BigEndian, &v.EmitterChain); err != nil {
		return fmt.Errorf("failed to read emitter chain: %w", err)
	}

	if err := mustRead(reader, v.EmitterAddress[:]); err != nil {
		return fmt.Errorf("failed to read emitter address: %w", err)
	}

	if err := binary.Read(reader, binary.BigEndian, &v.Sequence); err != nil {
		return fmt.Errorf("failed to read sequence: %w", err)
	}

	if err := binary.Read(reader, binary.BigEndian, &v.ConsistencyLevel); err != nil {
		return fmt.Errorf("failed to read consistency level: %w", err)
	}

	offset, err := reader.Seek(0, io.SeekCurrent)
	if err != nil {
		return fmt.Errorf("failed to seek reader: %w", err)
	}

	return PP(&v.Payload).UnmarshalBinary(data[offset:])
}
