package bridge

import (
	"bytes"
	"encoding/binary"
	"io"
	"os"
	"sync"
	"time"

	"github.com/pion/webrtc/v4/pkg/media/h264reader"
)

// Fake reproduz um arquivo H.264 Annex-B em loop no ritmo de fps — permite testar
// relay + navegador sem PS5. Input é apenas contado.
type Fake struct {
	frames [][]byte
	fps    int
	msgs   chan Msg
	done   chan struct{}
	once   sync.Once

	mu          sync.Mutex
	inputs      int
	idrRequests int
}

// NewFake lê o arquivo e agrupa as NALUs em frames (um frame termina numa NALU de slice).
func NewFake(path string, fps int) (*Fake, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	r, err := h264reader.NewReader(f)
	if err != nil {
		return nil, err
	}
	// Um access unit (frame) pode ter várias slices. Novo frame começa quando, já havendo
	// slice acumulada, chega uma NALU não-VCL (SPS/PPS/SEI/AUD) ou uma slice com
	// first_mb_in_slice == 0 (primeiro bit do slice header = 1 em ue(v)).
	var frames [][]byte
	var cur bytes.Buffer
	hasSlice := false
	flush := func() {
		if hasSlice {
			frames = append(frames, bytes.Clone(cur.Bytes()))
		}
		cur.Reset()
		hasSlice = false
	}
	for {
		nal, err := r.NextNAL()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		isSlice := nal.UnitType == h264reader.NalUnitTypeCodedSliceNonIdr || nal.UnitType == h264reader.NalUnitTypeCodedSliceIdr
		firstMB := isSlice && len(nal.Data) > 1 && nal.Data[1]&0x80 != 0
		if hasSlice && (!isSlice || firstMB) {
			flush()
		}
		cur.Write([]byte{0, 0, 0, 1})
		cur.Write(nal.Data)
		if isSlice {
			hasSlice = true
		}
	}
	flush()
	if fps <= 0 {
		fps = 60
	}
	return &Fake{frames: frames, fps: fps, msgs: make(chan Msg, 64), done: make(chan struct{})}, nil
}

func (f *Fake) FrameCount() int { return len(f.frames) }

// Run começa a emitir frames (chamado pela sessão quando o peer conecta).
func (f *Fake) Run() {
	go func() {
		defer close(f.msgs)
		f.msgs <- Msg{Type: MsgEvent, Payload: []byte(`{"event":"connected"}`)}
		t := time.NewTicker(time.Second / time.Duration(f.fps))
		defer t.Stop()
		for i := 0; ; i++ {
			select {
			case <-f.done:
				return
			case <-t.C:
				if len(f.frames) == 0 {
					continue
				}
				payload := make([]byte, 5, 5+len(f.frames[i%len(f.frames)]))
				binary.BigEndian.PutUint32(payload, 0)
				payload = append(payload, f.frames[i%len(f.frames)]...)
				select {
				case f.msgs <- Msg{Type: MsgVideo, Payload: payload}:
				case <-f.done:
					return
				}
			}
		}
	}()
}

func (f *Fake) Messages() <-chan Msg { return f.msgs }
func (f *Fake) SendController([]byte) {
	f.mu.Lock()
	f.inputs++
	f.mu.Unlock()
}
func (f *Fake) RequestIDR() {
	f.mu.Lock()
	f.idrRequests++
	f.mu.Unlock()
}
func (f *Fake) Stop()                 { f.once.Do(func() { close(f.done) }) }
func (f *Fake) Done() <-chan struct{} { return f.done }

func (f *Fake) Stats() (inputs, idr int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.inputs, f.idrRequests
}
