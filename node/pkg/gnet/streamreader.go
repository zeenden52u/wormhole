package gnet

import (
	"context"
	"encoding/binary"
	"errors"
	"io"
	"runtime"

	"go.uber.org/zap"
)

var (
	ErrMsgTooLong = errors.New("message too long")
)

// readLenDelim() Reads messages from rd where each message is delimited by a BigEndian Uint32 length field. Messages will be sent to msgC
func readLenDelim(ctx context.Context, logger *zap.Logger, rd io.Reader, msgC chan<- []byte) {
	buf := make([]byte, 10240*2)
	msgLen := uint32(0)
	var r uint32 = 0
	var w uint32 = 0

	for {

		// read at least 4 bytes
		for w-r < 4 {
			n, err := rd.Read(buf[w:])
			if err != nil {
				//logger.Error("error reading from stream", zap.Error(err))
				close(msgC)
				return
			}
			w += uint32(n)
			runtime.Gosched()
		}

		// read the length field
		msgLen = binary.BigEndian.Uint32(buf[r : r+4])
		r += 4
		if msgLen > uint32(len(buf))-w {
			logger.Fatal("Len is larger than remaining buffer", zap.Uint32("msgLen", msgLen), zap.Int("bufLen", len(buf)))
			//return
		}

		// read at least len bytes
		for w-r < msgLen {
			n, err := rd.Read(buf[w:])
			if err != nil {
				//logger.Error("error reading from stream", zap.Error(err))
				close(msgC)
				return
			}
			w += uint32(n)
			runtime.Gosched()
		}

		//logger.Info("received data", zap.Uint32("len", msgLen), zap.Binary("data", msg))

		// send the message
		msg := buf[r : r+msgLen]
		r += msgLen
		select {
		case <-ctx.Done():
			return
		case msgC <- msg:
		default:
			// skip message TODO report warning
			logger.Error("skipping message because channel full.")
		}

		// Make a new buffer if we're getting full
		if r > uint32(len(buf))/2 {
			newBuf := make([]byte, 10240*2)
			copy(newBuf[0:w-r], buf[r:w])
			w -= r
			r = 0
			buf = newBuf
		}
	}
}
