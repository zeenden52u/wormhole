package gnet

import (
	"encoding/hex"
	"errors"
	"fmt"

	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	eth_common "github.com/ethereum/go-ethereum/common"
	eth_crypto "github.com/ethereum/go-ethereum/crypto"

	"github.com/certusone/wormhole/node/pkg/common"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"google.golang.org/protobuf/proto"
)

// handleInboundMessage handles an incoming message on the Guardian Network.
// senderIdx is the guardian set index of the sender
func (g *GnetNode) handleInboundMessage(data []byte) {
	var msg gossipv1.GossipMessage
	err := proto.Unmarshal(data, &msg)
	if err != nil {
		g.logger.Info("received invalid message",
			zap.Binary("data", data),
		)
		return
	}

	if g.logger.Level().Enabled(zapcore.DebugLevel) {
		g.logger.Debug("received message",
			zap.Any("payload", msg.Message),
			zap.Binary("raw", data),
		)
	}

	switch m := msg.Message.(type) {
	case *gossipv1.GossipMessage_SignedObservation:
		if err := common.PostMsgWithTimestamp[gossipv1.SignedObservation](m.SignedObservation, g.obsvC); err == nil {
		} else {
			if WarnChannelOverflow {
				g.logger.Warn("Ignoring SignedObservation because obsvC full", zap.String("hash", hex.EncodeToString(m.SignedObservation.Hash)))
			}
		}
	case *gossipv1.GossipMessage_SignedObservationRequest:
		s := m.SignedObservationRequest
		gs := g.gst.Get()
		if gs == nil {
			g.logger.Warn("dropping SignedObservationRequest - no guardian set",
				zap.Any("value", s),
			)
			break
		}
		r, err := processSignedObservationRequest(s, gs)
		if err != nil {
			g.logger.Warn("invalid signed observation request received",
				zap.Error(err),
				zap.Any("payload", msg.Message),
				zap.Any("value", s),
				zap.Binary("raw", data),
			)
		} else {
			g.logger.Debug("valid signed observation request received",
				zap.Any("value", r),
			)

			select {
			case g.obsvReqC <- r:
			default:
			}
		}
	case *gossipv1.GossipMessage_SignedVaaWithQuorum:
		/*
			select {
			case g.signedInC <- m.SignedVaaWithQuorum:
			default:
				if WarnChannelOverflow {
					// TODO do not log this in production
					var hexStr string
					if vaa, err := vaa.Unmarshal(m.SignedVaaWithQuorum.Vaa); err == nil {
						hexStr = vaa.HexDigest()
					}
					g.logger.Warn("Ignoring SignedVaaWithQuorum because signedInC full", zap.String("hash", hexStr))
				}
			}
		*/
	default:
		g.logger.Warn("received unknown message type (running outdated software?)",
			zap.Any("payload", msg.Message),
			zap.Binary("raw", data),
		)
	}
}

func processSignedObservationRequest(s *gossipv1.SignedObservationRequest, gs *common.GuardianSet) (*gossipv1.ObservationRequest, error) {
	envelopeAddr := eth_common.BytesToAddress(s.GuardianAddr)
	idx, ok := gs.KeyIndex(envelopeAddr)
	var pk eth_common.Address
	if !ok {
		return nil, fmt.Errorf("invalid message: %s not in guardian set", envelopeAddr)
	} else {
		pk = gs.Keys[idx]
	}

	// SECURITY: see whitepapers/0009_guardian_key.md
	if len(signedObservationRequestPrefix)+len(s.ObservationRequest) < 34 {
		return nil, fmt.Errorf("invalid observation request: too short")
	}

	digest := signedObservationRequestDigest(s.ObservationRequest)

	pubKey, err := eth_crypto.Ecrecover(digest.Bytes(), s.Signature)
	if err != nil {
		return nil, errors.New("failed to recover public key")
	}

	signerAddr := eth_common.BytesToAddress(eth_crypto.Keccak256(pubKey[1:])[12:])
	if pk != signerAddr {
		return nil, fmt.Errorf("invalid signer: %v", signerAddr)
	}

	var h gossipv1.ObservationRequest
	err = proto.Unmarshal(s.ObservationRequest, &h)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal observation request: %w", err)
	}

	// TODO: implement per-guardian rate limiting

	return &h, nil
}
