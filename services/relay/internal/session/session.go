// Package session liga uma fonte (chiaki-bridge) a um navegador via WebRTC e aplica
// as regras de negócio do relay: grant obrigatório, um jogador por console,
// filtro de input e corte no exp do grant.
package session

import (
	"context"
	"crypto/ed25519"
	"encoding/binary"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"

	"leonidaplay/relay/internal/bridge"
	"leonidaplay/relay/internal/grant"
	"leonidaplay/relay/internal/input"
)

// WarnBefore: aviso de "tempo acabando" (estado EXPIRING na plataforma).
const WarnBefore = 60 * time.Second

// idrMinInterval evita inundar o PS5 com pedidos de keyframe quando o navegador manda vários PLIs.
const idrMinInterval = 500 * time.Millisecond

// SourceFactory cria a fonte de vídeo para a sessão validada.
type SourceFactory func(ctx context.Context, c *grant.Claims) (bridge.Source, error)

type Manager struct {
	pub       ed25519.PublicKey
	newSource SourceFactory
	iceConfig webrtc.Configuration
	fps       int
	now       func() time.Time

	mu       sync.Mutex
	active   map[string]*Session // por ConsoleID: um jogador por console
	usedJTIs map[string]time.Time
}

func NewManager(pub ed25519.PublicKey, f SourceFactory, ice webrtc.Configuration, fps int) *Manager {
	if fps <= 0 {
		fps = 60
	}
	return &Manager{pub: pub, newSource: f, iceConfig: ice, fps: fps, now: time.Now,
		active: map[string]*Session{}, usedJTIs: map[string]time.Time{}}
}

type Session struct {
	claims    *grant.Claims
	pc        *webrtc.PeerConnection
	src       bridge.Source
	control   *webrtc.DataChannel
	controlMu sync.Mutex
	closeOnce sync.Once
	started   time.Time
	done      chan struct{}
	stats     Stats
}

type Stats struct {
	mu           sync.Mutex
	VideoFrames  uint64 `json:"videoFrames"`
	VideoBytes   uint64 `json:"videoBytes"`
	FramesLost   int64  `json:"framesLost"`
	AudioPackets uint64 `json:"audioPackets"`
	Inputs       uint64 `json:"inputs"`
	PLIs         uint64 `json:"plis"`
}

type offerRequest struct {
	Grant string `json:"grant"`
	SDP   string `json:"sdp"`
}

type offerResponse struct {
	SDP       string    `json:"sdp"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// HandleOffer: POST {grant, sdp(offer)} → {sdp(answer), expiresAt}.
func (m *Manager) HandleOffer(w http.ResponseWriter, r *http.Request) {
	var req offerRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&req); err != nil {
		http.Error(w, "json inválido", http.StatusBadRequest)
		return
	}
	now := m.now() // time.Now carrega leitura monotônica: timers abaixo não sofrem ajuste de relógio
	claims, err := grant.Verify(req.Grant, m.pub, now)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	remaining := claims.ExpiresAt.Sub(now)

	m.mu.Lock()
	if _, used := m.usedJTIs[claims.ID]; used {
		m.mu.Unlock()
		http.Error(w, "grant já utilizado", http.StatusConflict)
		return
	}
	if _, busy := m.active[claims.ConsoleID]; busy {
		m.mu.Unlock()
		http.Error(w, "console em uso", http.StatusConflict)
		return
	}
	m.usedJTIs[claims.ID] = claims.ExpiresAt.Time
	s := &Session{claims: claims, started: now, done: make(chan struct{})}
	m.active[claims.ConsoleID] = s
	m.gcJTIs(now)
	m.mu.Unlock()

	answer, err := m.start(r.Context(), s, req.SDP, remaining)
	if err != nil {
		slog.Error("falha ao iniciar sessão", "session", claims.SessionID, "err", err)
		s.close(m, "start_failed")
		http.Error(w, "falha ao iniciar sessão: "+err.Error(), http.StatusBadGateway)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(offerResponse{SDP: answer, ExpiresAt: claims.ExpiresAt.Time})
}

func (m *Manager) gcJTIs(now time.Time) {
	for jti, exp := range m.usedJTIs {
		if now.After(exp.Add(time.Hour)) {
			delete(m.usedJTIs, jti)
		}
	}
}

func (m *Manager) start(ctx context.Context, s *Session, offerSDP string, remaining time.Duration) (string, error) {
	pc, err := webrtc.NewPeerConnection(m.iceConfig)
	if err != nil {
		return "", err
	}
	s.pc = pc

	video, err := webrtc.NewTrackLocalStaticSample(webrtc.RTPCodecCapability{
		MimeType: webrtc.MimeTypeH264, ClockRate: 90000,
		SDPFmtpLine: "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
	}, "video", "ps5")
	if err != nil {
		return "", err
	}
	audio, err := webrtc.NewTrackLocalStaticSample(webrtc.RTPCodecCapability{
		MimeType: webrtc.MimeTypeOpus, ClockRate: 48000, Channels: 2,
	}, "audio", "ps5")
	if err != nil {
		return "", err
	}
	videoSender, err := pc.AddTrack(video)
	if err != nil {
		return "", err
	}
	if _, err := pc.AddTrack(audio); err != nil {
		return "", err
	}

	pc.OnDataChannel(func(dc *webrtc.DataChannel) {
		switch dc.Label() {
		case "input":
			dc.OnMessage(func(msg webrtc.DataChannelMessage) { s.onInput(msg.Data) })
		case "control":
			s.controlMu.Lock()
			s.control = dc
			s.controlMu.Unlock()
		}
	})
	pc.OnConnectionStateChange(func(st webrtc.PeerConnectionState) {
		slog.Info("peer", "session", s.claims.SessionID, "state", st.String())
		if st == webrtc.PeerConnectionStateFailed || st == webrtc.PeerConnectionStateClosed {
			s.close(m, "peer_"+st.String())
		}
	})

	if err := pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: offerSDP}); err != nil {
		return "", err
	}
	ans, err := pc.CreateAnswer(nil)
	if err != nil {
		return "", err
	}
	gather := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(ans); err != nil {
		return "", err
	}
	select {
	case <-gather:
	case <-time.After(5 * time.Second):
		return "", errors.New("timeout coletando candidatos ICE")
	}

	// Fonte só sobe depois do SDP ok (evita acordar o PS5 à toa).
	src, err := m.newSource(context.WithoutCancel(ctx), s.claims)
	if err != nil {
		return "", err
	}
	s.src = src

	go s.readRTCP(videoSender)
	go s.pump(m, video, audio)
	go s.enforceDeadline(m, remaining)
	return pc.LocalDescription().SDP, nil
}

// pump: bridge → WebRTC, sem decodificar.
func (s *Session) pump(m *Manager, video, audio *webrtc.TrackLocalStaticSample) {
	frameDur := time.Second / time.Duration(m.fps)
	audioDur := 10 * time.Millisecond
	for {
		select {
		case <-s.src.Done():
			s.close(m, "source_ended")
			return
		case msg, ok := <-s.src.Messages():
			if !ok {
				s.close(m, "source_ended")
				return
			}
			switch msg.Type {
			case bridge.MsgVideo:
				if len(msg.Payload) < 5 {
					continue
				}
				lost := int32(binary.BigEndian.Uint32(msg.Payload[:4]))
				frame := msg.Payload[5:]
				s.stats.mu.Lock()
				s.stats.VideoFrames++
				s.stats.VideoBytes += uint64(len(frame))
				s.stats.FramesLost += int64(lost)
				s.stats.mu.Unlock()
				_ = video.WriteSample(media.Sample{Data: frame, Duration: frameDur})
			case bridge.MsgAudioHeader:
				if len(msg.Payload) >= 9 {
					rate := binary.BigEndian.Uint32(msg.Payload[1:5])
					fs := binary.BigEndian.Uint32(msg.Payload[5:9])
					if rate > 0 && fs > 0 {
						audioDur = time.Duration(fs) * time.Second / time.Duration(rate)
					}
				}
			case bridge.MsgAudio:
				s.stats.mu.Lock()
				s.stats.AudioPackets++
				s.stats.mu.Unlock()
				_ = audio.WriteSample(media.Sample{Data: msg.Payload, Duration: audioDur})
			case bridge.MsgEvent:
				slog.Info("bridge event", "session", s.claims.SessionID, "event", string(msg.Payload))
				s.sendControl(json.RawMessage(msg.Payload))
			}
		}
	}
}

// readRTCP: PLI/FIR do navegador → pedido de keyframe (IDR) ao PS5.
func (s *Session) readRTCP(sender *webrtc.RTPSender) {
	var last time.Time
	for {
		pkts, _, err := sender.ReadRTCP()
		if err != nil {
			return
		}
		for _, p := range pkts {
			switch p.(type) {
			case *rtcp.PictureLossIndication, *rtcp.FullIntraRequest:
				s.stats.mu.Lock()
				s.stats.PLIs++
				s.stats.mu.Unlock()
				if time.Since(last) >= idrMinInterval {
					last = time.Now()
					s.src.RequestIDR()
				}
			}
		}
	}
}

func (s *Session) onInput(data []byte) {
	clean, err := input.Sanitize(data)
	if err != nil {
		return
	}
	s.stats.mu.Lock()
	s.stats.Inputs++
	s.stats.mu.Unlock()
	if s.src != nil {
		s.src.SendController(clean)
	}
}

// enforceDeadline: aviso em T-60 s e corte no exp, com timers monotônicos locais —
// não depende da plataforma estar no ar.
func (s *Session) enforceDeadline(m *Manager, remaining time.Duration) {
	if remaining > WarnBefore {
		select {
		case <-time.After(remaining - WarnBefore):
		case <-s.done:
			return
		}
		s.sendControl(map[string]any{"t": "expiring", "remainingSeconds": int(WarnBefore.Seconds())})
		remaining = WarnBefore
	}
	select {
	case <-time.After(remaining):
	case <-s.done:
		return
	}
	s.sendControl(map[string]any{"t": "ended", "reason": "time_up"})
	s.close(m, "time_up")
}

func (s *Session) sendControl(v any) {
	s.controlMu.Lock()
	defer s.controlMu.Unlock()
	if s.control == nil || s.control.ReadyState() != webrtc.DataChannelStateOpen {
		return
	}
	b, err := json.Marshal(v)
	if err == nil {
		_ = s.control.SendText(string(b))
	}
}

func (s *Session) close(m *Manager, reason string) {
	s.closeOnce.Do(func() {
		close(s.done)
		s.stats.mu.Lock()
		slog.Info("sessão encerrada", "session", s.claims.SessionID, "reason", reason,
			"duration", time.Since(s.started).Round(time.Millisecond).String(),
			"frames", s.stats.VideoFrames, "mb", s.stats.VideoBytes>>20, "framesLost", s.stats.FramesLost,
			"plis", s.stats.PLIs, "inputs", s.stats.Inputs)
		s.stats.mu.Unlock()
		if s.src != nil {
			s.src.Stop()
		}
		if s.pc != nil {
			// pequeno atraso para a mensagem "ended" sair antes de fechar o canal
			time.AfterFunc(200*time.Millisecond, func() { s.pc.Close() })
		}
		m.mu.Lock()
		if m.active[s.claims.ConsoleID] == s {
			delete(m.active, s.claims.ConsoleID)
		}
		m.mu.Unlock()
	})
}

// HandleList: GET /sessions — visão operacional (spike).
func (m *Manager) HandleList(w http.ResponseWriter, _ *http.Request) {
	type row struct {
		SessionID string    `json:"sessionId"`
		ConsoleID string    `json:"consoleId"`
		ExpiresAt time.Time `json:"expiresAt"`
		Frames    uint64    `json:"videoFrames"`
		MB        uint64    `json:"videoMB"`
	}
	m.mu.Lock()
	out := make([]row, 0, len(m.active))
	for _, s := range m.active {
		s.stats.mu.Lock()
		out = append(out, row{s.claims.SessionID, s.claims.ConsoleID, s.claims.ExpiresAt.Time, s.stats.VideoFrames, s.stats.VideoBytes >> 20})
		s.stats.mu.Unlock()
	}
	m.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}
