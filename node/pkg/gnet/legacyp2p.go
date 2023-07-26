package gnet

import (
	"context"
	"crypto/ecdsa"
	"errors"
	"fmt"
	"strings"

	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	pubsub "github.com/libp2p/go-libp2p-pubsub"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/multiformats/go-multiaddr"
	"go.uber.org/zap"
	"google.golang.org/protobuf/proto"
)

// bootstrapAddrs takes a comma-separated string of multi-address strings and returns an array of []peer.AddrInfo that does not include `self`.
// if `self` is part of `bootstrapPeers`, return isBootstrapNode=true
func bootstrapAddrs(logger *zap.Logger, bootstrapPeers string, self peer.ID) (bootstrappers []peer.AddrInfo, isBootstrapNode bool) {
	bootstrappers = make([]peer.AddrInfo, 0)
	for _, addr := range strings.Split(bootstrapPeers, ",") {
		if addr == "" {
			continue
		}
		ma, err := multiaddr.NewMultiaddr(addr)
		if err != nil {
			logger.Error("invalid bootstrap address", zap.String("peer", addr), zap.Error(err))
			continue
		}
		pi, err := peer.AddrInfoFromP2pAddr(ma)
		if err != nil {
			logger.Error("invalid bootstrap address", zap.String("peer", addr), zap.Error(err))
			continue
		}
		if pi.ID == self {
			logger.Info("We're a bootstrap node")
			isBootstrapNode = true
			continue
		}
		bootstrappers = append(bootstrappers, *pi)
	}
	return
}

// connectToPeers connects `h` to `peers` and returns the number of successful connections.
func connectToPeers(ctx context.Context, logger *zap.Logger, h host.Host, peers []peer.AddrInfo) (successes int) {
	successes = 0
	for _, p := range peers {
		if err := h.Connect(ctx, p); err != nil {
			logger.Error("failed to connect to bootstrap peer", zap.String("peer", p.String()), zap.Error(err))
		} else {
			successes += 1
		}
	}
	return successes
}

func (g *GnetNode) RunLegacyP2P(
	obsvReqSendC <-chan *gossipv1.ObservationRequest,
	gossipSendC <-chan []byte,
	gk *ecdsa.PrivateKey,
	networkID string,
	nodeName string,
	rootCtxCancel context.CancelFunc,
) supervisor.Runnable {

	return func(ctx context.Context) error {
		logger := supervisor.Logger(ctx)

		defer func() {
			// TODO: Right now we're canceling the root context because it used to be the case that libp2p cannot be cleanly restarted.
			// But that seems to no longer be the case. We may want to revisit this. See (https://github.com/libp2p/go-libp2p/issues/992) for background.
			logger.Warn("p2p routine has exited, cancelling root context...")
			rootCtxCancel()
		}()

		topic := fmt.Sprintf("%s/%s", networkID, "broadcast")

		logger.Info("Subscribing pubsub topic", zap.String("topic", topic))
		ps, err := pubsub.NewGossipSub(ctx, g.h)
		if err != nil {
			panic(err)
		}

		th, err := ps.Join(topic)
		if err != nil {
			return fmt.Errorf("failed to join topic: %w", err)
		}

		defer func() {
			if err := th.Close(); err != nil && !errors.Is(err, context.Canceled) {
				logger.Error("Error closing the topic", zap.Error(err))
			}
		}()

		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case msg := <-gossipSendC:
					err := th.Publish(ctx, msg)
					if err != nil {
						logger.Error("failed to publish message from queue", zap.Error(err))
					}
				case msg := <-obsvReqSendC:
					b, err := proto.Marshal(msg)
					if err != nil {
						panic(err)
					}

					// Sign the observation request using our node's guardian key.
					digest := signedObservationRequestDigest(b)
					sig, err := ethcrypto.Sign(digest.Bytes(), gk)
					if err != nil {
						panic(err)
					}

					sReq := &gossipv1.SignedObservationRequest{
						ObservationRequest: b,
						Signature:          sig,
						GuardianAddr:       ethcrypto.PubkeyToAddress(gk.PublicKey).Bytes(),
					}

					envelope := &gossipv1.GossipMessage{
						Message: &gossipv1.GossipMessage_SignedObservationRequest{
							SignedObservationRequest: sReq}}

					b, err = proto.Marshal(envelope)
					if err != nil {
						panic(err)
					}

					err = th.Publish(ctx, b)
					if err != nil {
						logger.Error("failed to publish observation request", zap.Error(err))
					} else {
						logger.Info("published signed observation request", zap.Any("signed_observation_request", sReq))
					}
				}
			}
		}()

		<-ctx.Done()
		return nil
	}
}
