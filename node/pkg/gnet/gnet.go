package gnet

import (
	"context"
	"crypto/ecdsa"
	"encoding/binary"
	"fmt"
	"sync"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	eth_common "github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/multiformats/go-multiaddr"
	"go.uber.org/zap"

	"github.com/libp2p/go-libp2p"
	dht "github.com/libp2p/go-libp2p-kad-dht"

	"github.com/libp2p/go-libp2p/core/network"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/peerstore"
	"github.com/libp2p/go-libp2p/core/routing"
	libp2ptls "github.com/libp2p/go-libp2p/p2p/security/tls"
	libp2pquic "github.com/libp2p/go-libp2p/p2p/transport/quic"

	libp2p_crypto "github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/protocol"

	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
)

// Config
var (
	WarnChannelOverflow = true
)

const (
	GossipDefaultPort = 8999
	GnetDefaultPort   = 8998
)

// TODO gnet should not handle any application-layer stuff; verification of these should be moved to the processor or so.
var signedObservationRequestPrefix = []byte("signed_observation_request|")

func signedObservationRequestDigest(b []byte) eth_common.Hash {
	return ethcrypto.Keccak256Hash(append(signedObservationRequestPrefix, b...))
}

// Protocol IDs
const GnetProtocolId protocol.ID = "/wormhole/guardiannet/0.0.1"

type GnetNode struct {
	logger               *zap.Logger
	h                    host.Host // reference to this node's libp2p host
	guardiansAddrStrings []string
	guardians            []peer.ID        // mapping guardians by guardian set index to libp2p peer ID
	guardianConns        []network.Stream // connections to all guardians

	// legacy stuff
	gst *common.GuardianSetState

	// channels
	obsvC        chan<- *common.MsgWithTimeStamp[gossipv1.SignedObservation]
	obsvReqC     chan<- *gossipv1.ObservationRequest
	obsvReqSendC <-chan *gossipv1.ObservationRequest
	gossipSendC  chan []byte
	signedInC    chan<- *gossipv1.SignedVAAWithQuorum
}

func (g *GnetNode) listen(ctx context.Context, protocolId protocol.ID) {
	g.h.SetStreamHandler(protocolId, func(s network.Stream) {
		// TODO verify s.Conn().RemotePeer() or similar
		msgC := make(chan []byte, 10000)
		go readLenDelim(ctx, g.logger, s, msgC)
		go g.handleInboundMessageStream(msgC)
		go g.handleInboundMessageStream(msgC)
		g.handleInboundMessageStream(msgC)
		s.Close()
	})
}

func (g *GnetNode) handleInboundMessageStream(msgC chan []byte) {
	for msg := range msgC {
		g.handleInboundMessage(msg)
	}
}

func (g *GnetNode) connect(ctx context.Context, logger *zap.Logger) {
	// SETUP GNET
	numPeers := len(g.guardiansAddrStrings)
	g.guardians = make([]peer.ID, numPeers)
	g.guardianConns = make([]network.Stream, numPeers)

	for i, addrString := range g.guardiansAddrStrings {
		if addrString == "" {
			continue
		}
		ma, err := multiaddr.NewMultiaddr(addrString)
		if err != nil {
			panic(err)
		}
		pi, err := peer.AddrInfoFromP2pAddr(ma)
		if err != nil {
			panic(err)
		}

		// Add the address
		g.h.Peerstore().AddAddrs(pi.ID, pi.Addrs, peerstore.PermanentAddrTTL)

		// Connect to the peer
		if err := g.h.Connect(ctx, *pi); err != nil {
			logger.Error("failed to connect to peer", zap.String("peer", pi.String()), zap.Error(err))
		}
		g.guardians[i] = pi.ID

		// open a stream with the peer
		c, err := g.h.NewStream(ctx, pi.ID, GnetProtocolId)
		if c == nil || err != nil {
			logger.Error("failed to open stream with peer", zap.String("peer", pi.String()), zap.Error(err))
		}
		g.guardianConns[i] = c
	}
}

func (g *GnetNode) send(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-g.gossipSendC:
			if len(msg) == 0 {
				continue
			}
			//g.logger.Info("sending message", zap.Int("len", len(msg)), zap.Binary("data", msg))
			data := make([]byte, 4)
			binary.BigEndian.PutUint32(data, uint32(len(msg)))
			data = append(data, msg...)

			for i, c := range g.guardianConns {
				if c == nil {
					continue
				}
				n, err := c.Write(data)
				if n != len(data) || err != nil {
					g.logger.Error("error writing data to stream", zap.Int("streamIdx", i), zap.Error(err))
					continue
				}
			}

		}
	}
}

// nolint
func duplicateChannel[T any](c <-chan T) (chan T, chan T) {
	cap := cap(c)
	c1 := make(chan T, cap)
	c2 := make(chan T, cap)

	go func() {
		for x := range c {
			c1 <- x
			c2 <- x
		}
	}()

	return c1, c2
}

func GnetRunnable(
	ctx context.Context,

	gst *common.GuardianSetState,

	// libp2p stuff
	priv libp2p_crypto.PrivKey,
	legacyP2pNetworkId string,
	p2pPort uint,
	p2pBootstrapPeers string,
	gk *ecdsa.PrivateKey,
	nodeName string,
	rootCtxCancel context.CancelFunc,

	// gnet
	guardianPeerAddrStrings []string,

	// channels
	obsvC chan<- *common.MsgWithTimeStamp[gossipv1.SignedObservation],
	obsvReqC chan<- *gossipv1.ObservationRequest,
	obsvReqSendCPARENT <-chan *gossipv1.ObservationRequest,
	gossipSendCPARENT chan []byte,
	signedInC chan<- *gossipv1.SignedVAAWithQuorum,

	// housekeeping
	onlineWg *sync.WaitGroup,
) supervisor.Runnable {

	return func(ctx context.Context) error {
		logger := supervisor.Logger(ctx)

		obsvReqSendC1 := obsvReqSendCPARENT
		gossipSendC1 := gossipSendCPARENT
		obsvReqSendC2 := make(<-chan *gossipv1.ObservationRequest)
		gossipSendC2 := make(chan []byte)
		// TODO duplicate to gossip
		//obsvReqSendC1, obsvReqSendC2 := duplicateChannel(obsvReqSendCPARENT)
		//gossipSendC1, gossipSendC2 := duplicateChannel(gossipSendCPARENT)

		h, err := libp2p.New(
			// Use the keypair we generated
			libp2p.Identity(priv),

			// Multiple listen addresses
			libp2p.ListenAddrStrings(fmt.Sprintf("/ip4/0.0.0.0/udp/%d/quic", p2pPort)),

			// Enable TLS security as the only security protocol.
			libp2p.Security(libp2ptls.ID, libp2ptls.New),

			// Enable QUIC transport as the only transport.
			libp2p.Transport(libp2pquic.NewTransport),

			// Let's prevent our peer from having too many
			// connections by attaching a connection manager.
			// TODO add ConnMgr
			//libp2p.ConnectionManager(components.ConnMgr),

			// Let this host use the DHT to find other hosts
			libp2p.Routing(func(h host.Host) (routing.PeerRouting, error) {
				logger.Info("Connecting to bootstrap peers", zap.String("bootstrap_peers", p2pBootstrapPeers))

				bootstrappers, _ := bootstrapAddrs(logger, p2pBootstrapPeers, h.ID())

				// TODO(leo): Persistent data store (i.e. address book)
				idht, err := dht.New(ctx, h, dht.Mode(dht.ModeServer),
					// This intentionally makes us incompatible with the global IPFS DHT
					dht.ProtocolPrefix(protocol.ID("/"+legacyP2pNetworkId)),
					dht.BootstrapPeers(bootstrappers...),
				)
				return idht, err
			}),
		)

		if err != nil {
			panic(err)
		}

		defer func() {
			if err := h.Close(); err != nil {
				logger.Error("error closing the host", zap.Error(err))
			}
		}()

		// Make sure we connect to at least 1 bootstrap node (this is particularly important in a local devnet and CI
		// as peer discovery can take a long time).

		bootstrappers, bootstrapNode := bootstrapAddrs(logger, p2pBootstrapPeers, h.ID())
		successes := connectToPeers(ctx, logger, h, bootstrappers)

		if bootstrapNode {
			logger.Info("We are a bootstrap node.")
		}

		if successes == 0 && !bootstrapNode { // If we're a bootstrap node it's okay to not have any peers.
			// If we fail to connect to any bootstrap peer, kill the service
			// returning from this function will lead to rootCtxCancel() being called in the defer() above. The service will then be restarted by Tilt/kubernetes.
			panic("failed to connect to any bootstrap peer")
		}
		logger.Info("Connected to bootstrap peers", zap.Int("num", successes))

		logger.Info("Node has been started", zap.String("peer_id", h.ID().String()),
			zap.String("addrs", fmt.Sprintf("%v", h.Addrs())))

		g := &GnetNode{
			logger:               logger,
			h:                    h,
			guardiansAddrStrings: guardianPeerAddrStrings,

			gst: gst,

			obsvC:        obsvC,
			obsvReqC:     obsvReqC,
			obsvReqSendC: obsvReqSendC1,
			gossipSendC:  gossipSendC1,
			signedInC:    signedInC,
		}

		g.listen(ctx, GnetProtocolId)
		onlineWg.Done()
		logger.Info("gnet node online")

		err = supervisor.Run(ctx, "legacyP2P", g.RunLegacyP2P(obsvReqSendC2, gossipSendC2, gk, legacyP2pNetworkId, nodeName, rootCtxCancel))
		if err != nil {
			panic(err)
		}

		onlineWg.Wait()
		logger.Info("connecting to other gnet nodes")
		g.connect(ctx, logger)
		logger.Info("connected")
		g.send(ctx)
		return nil
	}
}
