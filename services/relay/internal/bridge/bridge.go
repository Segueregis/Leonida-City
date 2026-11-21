// Package bridge fala com o processo chiaki-bridge (C) por unix socket.
// Protocolo: services/relay/bridge/PROTOCOL.md.
package bridge

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

const (
	MsgVideo       byte = 0x01
	MsgAudio       byte = 0x02
	MsgAudioHeader byte = 0x03
	MsgEvent       byte = 0x04
	MsgController  byte = 0x10
	MsgRequestIDR  byte = 0x11
	MsgStop        byte = 0x12

	// MaxPayload limita frames vindos do bridge (keyframe 1080p cabe com folga).
	MaxPayload = 8 << 20
)

type Msg struct {
	Type    byte
	Payload []byte
}

func ReadMsg(r io.Reader) (Msg, error) {
	var hdr [5]byte
	if _, err := io.ReadFull(r, hdr[:]); err != nil {
		return Msg{}, err
	}
	n := binary.BigEndian.Uint32(hdr[1:])
	if n > MaxPayload {
		return Msg{}, fmt.Errorf("mensagem do bridge grande demais: %d bytes", n)
	}
	p := make([]byte, n)
	if _, err := io.ReadFull(r, p); err != nil {
		return Msg{}, err
	}
	return Msg{Type: hdr[0], Payload: p}, nil
}

func WriteMsg(w io.Writer, t byte, payload []byte) error {
	buf := make([]byte, 5+len(payload))
	buf[0] = t
	binary.BigEndian.PutUint32(buf[1:], uint32(len(payload)))
	copy(buf[5:], payload)
	_, err := w.Write(buf)
	return err
}

// Source é o que a sessão WebRTC consome: o bridge real ou uma fonte falsa (testes locais).
type Source interface {
	Messages() <-chan Msg
	SendController(state []byte)
	RequestIDR()
	Stop()
	Done() <-chan struct{}
}

// Config para iniciar um bridge real.
type Config struct {
	BinaryPath  string
	DUID        string // hex, 64 chars
	AccountID   string // base64, 8 bytes
	PSNToken    string // vai por variável de ambiente, nunca por argv
	Resolution  int
	FPS         int
	BitrateKbps int
}

// Process é um chiaki-bridge em execução ligado a um unix socket exclusivo.
type Process struct {
	cmd     *exec.Cmd
	conn    net.Conn
	msgs    chan Msg
	done    chan struct{}
	writeMu sync.Mutex
	once    sync.Once
	dir     string
}

// Start cria o socket, inicia o bridge e espera ele conectar.
func Start(ctx context.Context, cfg Config) (*Process, error) {
	dir, err := os.MkdirTemp("", "lp-bridge-")
	if err != nil {
		return nil, err
	}
	sock := filepath.Join(dir, "b.sock")
	ln, err := net.Listen("unix", sock)
	if err != nil {
		os.RemoveAll(dir)
		return nil, err
	}
	defer ln.Close()

	args := []string{"run", "--duid", cfg.DUID, "--account-id", cfg.AccountID, "--socket", sock}
	if cfg.Resolution > 0 {
		args = append(args, "--res", fmt.Sprint(cfg.Resolution))
	}
	if cfg.FPS > 0 {
		args = append(args, "--fps", fmt.Sprint(cfg.FPS))
	}
	if cfg.BitrateKbps > 0 {
		args = append(args, "--bitrate", fmt.Sprint(cfg.BitrateKbps))
	}
	cmd := exec.Command(cfg.BinaryPath, args...)
	cmd.Env = []string{"CHIAKI_PSN_TOKEN=" + cfg.PSNToken, "PATH=" + os.Getenv("PATH")}
	cmd.Stdout = os.Stderr
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		os.RemoveAll(dir)
		return nil, fmt.Errorf("iniciar bridge: %w", err)
	}

	type acc struct {
		c   net.Conn
		err error
	}
	ch := make(chan acc, 1)
	go func() { c, err := ln.Accept(); ch <- acc{c, err} }()

	var conn net.Conn
	select {
	case a := <-ch:
		if a.err != nil {
			cmd.Process.Kill()
			os.RemoveAll(dir)
			return nil, a.err
		}
		conn = a.c
	case <-time.After(10 * time.Second):
		cmd.Process.Kill()
		os.RemoveAll(dir)
		return nil, errors.New("bridge não conectou ao socket em 10 s")
	case <-ctx.Done():
		cmd.Process.Kill()
		os.RemoveAll(dir)
		return nil, ctx.Err()
	}

	p := &Process{cmd: cmd, conn: conn, msgs: make(chan Msg, 256), done: make(chan struct{}), dir: dir}
	go p.readLoop()
	go func() {
		err := cmd.Wait()
		slog.Info("bridge terminou", "err", err)
		p.close()
	}()
	return p, nil
}

func (p *Process) readLoop() {
	defer close(p.msgs)
	for {
		m, err := ReadMsg(p.conn)
		if err != nil {
			p.close()
			return
		}
		select {
		case p.msgs <- m:
		case <-p.done:
			return
		}
	}
}

func (p *Process) send(t byte, payload []byte) {
	p.writeMu.Lock()
	defer p.writeMu.Unlock()
	p.conn.SetWriteDeadline(time.Now().Add(time.Second))
	if err := WriteMsg(p.conn, t, payload); err != nil {
		p.close()
	}
}

func (p *Process) Messages() <-chan Msg        { return p.msgs }
func (p *Process) SendController(state []byte) { p.send(MsgController, state) }
func (p *Process) RequestIDR()                 { p.send(MsgRequestIDR, nil) }
func (p *Process) Done() <-chan struct{}       { return p.done }

// Stop pede encerramento limpo; se o bridge não sair em 2 s, mata o processo.
func (p *Process) Stop() {
	p.send(MsgStop, nil)
	select {
	case <-p.done:
	case <-time.After(2 * time.Second):
		p.cmd.Process.Kill()
		p.close()
	}
}

func (p *Process) close() {
	p.once.Do(func() {
		close(p.done)
		p.conn.Close()
		os.RemoveAll(p.dir)
	})
}
