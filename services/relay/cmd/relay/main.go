// relay — ponte PS5 → navegador do LeonidaPlay (spike F0).
//
//	relay keygen
//	relay mint-grant -key PRIV -session S -console C -seconds 120
//	relay psn-login [-out build/psn-secondary.json]
//	relay serve -grant-pub PUB [-fake video.h264 | -psn-file build/psn-secondary.json -duid HEX]
//
// No modo real o relay renova o access token PSN antes de cada sessão a partir do refresh token
// (em produção: credencial decifrada do banco).
package main

import (
	"bufio"
	"context"
	"crypto/ed25519"
	"embed"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/pion/webrtc/v4"

	"leonidaplay/relay/internal/bridge"
	"leonidaplay/relay/internal/grant"
	"leonidaplay/relay/internal/psn"
	"leonidaplay/relay/internal/session"
)

//go:embed web
var webFS embed.FS

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	switch os.Args[1] {
	case "keygen":
		keygen()
	case "mint-grant":
		mintGrant(os.Args[2:])
	case "psn-login":
		psnLogin(os.Args[2:])
	case "psn-devices":
		psnDevices(os.Args[2:])
	case "serve":
		serve(os.Args[2:])
	default:
		usage()
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "uso: relay keygen | mint-grant | psn-login | psn-devices | serve  (use -h em cada subcomando)")
	os.Exit(2)
}

func keygen() {
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		panic(err)
	}
	fmt.Println("SESSION_GRANT_PRIVATE_KEY=" + base64.StdEncoding.EncodeToString(priv))
	fmt.Println("SESSION_GRANT_PUBLIC_KEY=" + base64.StdEncoding.EncodeToString(pub))
}

func mintGrant(args []string) {
	fl := flag.NewFlagSet("mint-grant", flag.ExitOnError)
	key := fl.String("key", os.Getenv("SESSION_GRANT_PRIVATE_KEY"), "chave privada Ed25519 (base64)")
	sid := fl.String("session", "spike-session", "id da sessão")
	cid := fl.String("console", "spike-console", "id do console")
	secs := fl.Int("seconds", 120, "duração do grant em segundos")
	fl.Parse(args)
	priv, err := grant.ParsePrivateKey(*key)
	if err != nil {
		fatal(err)
	}
	tok, err := grant.Mint(priv, *sid, *cid, time.Duration(*secs)*time.Second, time.Now())
	if err != nil {
		fatal(err)
	}
	fmt.Println(tok)
}

// psnCredential: o que a plataforma guardará cifrado em ConsoleCredential.
type psnCredential struct {
	AccountID    string    `json:"accountId"`
	RefreshToken string    `json:"refreshToken"`
	SavedAt      time.Time `json:"savedAt"`
}

func psnLogin(args []string) {
	fl := flag.NewFlagSet("psn-login", flag.ExitOnError)
	out := fl.String("out", "build/psn-secondary.json", "arquivo onde salvar a credencial (permissão 0600)")
	fl.Parse(args)

	fmt.Println("1) Abra este link e entre com a conta PSN SECUNDÁRIA do PS5:")
	fmt.Println()
	fmt.Println(psn.LoginURL())
	fmt.Println()
	fmt.Println("2) Depois do login a página fica em branco/erro. Copie a URL inteira da barra")
	fmt.Println("   (começa com https://remoteplay.dl.playstation.net/remoteplay/redirect?code=...) e cole aqui:")
	fmt.Print("> ")
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil {
		fatal(err)
	}
	code, err := psn.CodeFromRedirect(line)
	if err != nil {
		fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	c := &psn.Client{}
	tok, err := c.Exchange(ctx, code)
	if err != nil {
		fatal(err)
	}
	acc, err := c.AccountID(ctx, tok.AccessToken)
	if err != nil {
		fatal(err)
	}
	if err := savePSN(*out, psnCredential{AccountID: acc, RefreshToken: tok.RefreshToken, SavedAt: time.Now()}); err != nil {
		fatal(err)
	}
	fmt.Println()
	fmt.Println("OK. Credencial salva em", *out, "(não compartilhe este arquivo).")
	fmt.Println("Account ID:", acc)
	fmt.Println("Próximo passo — descobrir o DUID do PS5:")
	fmt.Println("  relay psn-devices -psn-file", *out)
}

func savePSN(path string, cred psnCredential) error {
	b, _ := json.MarshalIndent(cred, "", "  ")
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func loadPSN(path string) (psnCredential, error) {
	var c psnCredential
	b, err := os.ReadFile(path)
	if err != nil {
		return c, err
	}
	return c, json.Unmarshal(b, &c)
}

// freshAccessToken renova o access token e regrava o refresh token (a PSN o rotaciona).
func freshAccessToken(ctx context.Context, path string) (string, psnCredential, error) {
	cred, err := loadPSN(path)
	if err != nil {
		return "", cred, err
	}
	tok, err := (&psn.Client{}).Refresh(ctx, cred.RefreshToken)
	if err != nil {
		return "", cred, fmt.Errorf("renovar token PSN: %w (rode relay psn-login de novo)", err)
	}
	if tok.RefreshToken != "" {
		cred.RefreshToken = tok.RefreshToken
		cred.SavedAt = time.Now()
		if err := savePSN(path, cred); err != nil {
			return "", cred, err
		}
	}
	return tok.AccessToken, cred, nil
}

func psnDevices(args []string) {
	fl := flag.NewFlagSet("psn-devices", flag.ExitOnError)
	file := fl.String("psn-file", "build/psn-secondary.json", "credencial salva pelo psn-login")
	bin := fl.String("bridge", "./build/bridge/chiaki-bridge", "binário do chiaki-bridge")
	fl.Parse(args)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	token, _, err := freshAccessToken(ctx, *file)
	if err != nil {
		fatal(err)
	}
	cmd := exec.CommandContext(ctx, *bin, "list")
	cmd.Env = []string{"CHIAKI_PSN_TOKEN=" + token, "PATH=" + os.Getenv("PATH")}
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	if err := cmd.Run(); err != nil {
		fatal(err)
	}
}

func serve(args []string) {
	fl := flag.NewFlagSet("serve", flag.ExitOnError)
	addr := fl.String("addr", ":8080", "endereço HTTP")
	pubB64 := fl.String("grant-pub", os.Getenv("SESSION_GRANT_PUBLIC_KEY"), "chave pública Ed25519 dos grants (base64)")
	fake := fl.String("fake", "", "arquivo H.264 Annex-B para simular o PS5 (sem bridge)")
	bin := fl.String("bridge", "./build/bridge/chiaki-bridge", "binário do chiaki-bridge")
	duid := fl.String("duid", "", "DUID do PS5 (hex) — modo real")
	psnFile := fl.String("psn-file", "", "credencial salva pelo psn-login — modo real")
	res := fl.Int("res", 1080, "resolução pedida ao PS5")
	fps := fl.Int("fps", 60, "fps pedido ao PS5")
	bitrate := fl.Int("bitrate", 0, "bitrate em kbps (0 = padrão do preset)")
	stun := fl.String("stun", "stun:stun.l.google.com:19302", "servidores STUN separados por vírgula (vazio = nenhum)")
	fl.Parse(args)

	pub, err := grant.ParsePublicKey(*pubB64)
	if err != nil {
		fatal(err)
	}

	var factory session.SourceFactory
	switch {
	case *fake != "":
		f, err := bridge.NewFake(*fake, *fps)
		if err != nil {
			fatal(err)
		}
		slog.Info("modo fake", "arquivo", *fake, "frames", f.FrameCount())
		factory = func(ctx context.Context, c *grant.Claims) (bridge.Source, error) {
			src, err := bridge.NewFake(*fake, *fps)
			if err != nil {
				return nil, err
			}
			src.Run()
			return src, nil
		}
	case *duid != "" && *psnFile != "":
		if _, err := loadPSN(*psnFile); err != nil {
			fatal(fmt.Errorf("ler %s: %w", *psnFile, err))
		}
		factory = func(ctx context.Context, c *grant.Claims) (bridge.Source, error) {
			rctx, cancel := context.WithTimeout(ctx, 15*time.Second)
			defer cancel()
			token, cred, err := freshAccessToken(rctx, *psnFile)
			if err != nil {
				return nil, err
			}
			return bridge.Start(ctx, bridge.Config{BinaryPath: *bin, DUID: *duid, AccountID: cred.AccountID, PSNToken: token,
				Resolution: *res, FPS: *fps, BitrateKbps: *bitrate})
		}
	default:
		fatal(fmt.Errorf("use -fake ARQUIVO ou -psn-file + -duid"))
	}

	var ice webrtc.Configuration
	if *stun != "" {
		ice.ICEServers = []webrtc.ICEServer{{URLs: strings.Split(*stun, ",")}}
	}
	mgr := session.NewManager(pub, factory, ice, *fps)

	static, _ := fs.Sub(webFS, "web")
	mux := http.NewServeMux()
	mux.Handle("GET /", http.FileServerFS(static))
	mux.HandleFunc("POST /offer", mgr.HandleOffer)
	mux.HandleFunc("GET /sessions", mgr.HandleList)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })

	srv := &http.Server{Addr: *addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		slog.Info("relay ouvindo", "addr", *addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fatal(err)
		}
	}()
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}

func fatal(err error) {
	slog.Error(err.Error())
	os.Exit(1)
}
