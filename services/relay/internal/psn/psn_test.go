package psn

import (
	"encoding/base64"
	"encoding/binary"
	"strings"
	"testing"
)

func TestEncodeAccountID(t *testing.T) {
	got, err := EncodeAccountID("1234567890123456789")
	if err != nil {
		t.Fatal(err)
	}
	b, _ := base64.StdEncoding.DecodeString(got)
	if len(b) != 8 || binary.LittleEndian.Uint64(b) != 1234567890123456789 {
		t.Fatalf("account id errado: %s", got)
	}
	if _, err := EncodeAccountID("abc"); err == nil {
		t.Fatal("user_id inválido aceito")
	}
}

func TestCodeFromRedirect(t *testing.T) {
	code, err := CodeFromRedirect("https://remoteplay.dl.playstation.net/remoteplay/redirect?code=AbC123&cid=x")
	if err != nil || code != "AbC123" {
		t.Fatalf("code=%q err=%v", code, err)
	}
	if code, err := CodeFromRedirect("  v3.AbC_123-x \n"); err != nil || code != "v3.AbC_123-x" {
		t.Fatalf("código puro: code=%q err=%v", code, err)
	}
	for _, bad := range []string{
		"https://evil.example.com/remoteplay/redirect?code=AbC123",
		"https://remoteplay.dl.playstation.net/remoteplay/redirect?nocode=1",
		"https://remoteplay.dl.playstation.net/remoteplay/redirect?code=",
		"https://remoteplay.dl.playstation.net/remoteplay/redirect?error=access_denied",
		"",
		"isso tem espaço",
	} {
		if _, err := CodeFromRedirect(bad); err == nil {
			t.Errorf("aceitou %q", bad)
		}
	}
}

func TestLoginURL(t *testing.T) {
	u := LoginURL()
	if !strings.HasPrefix(u, "https://auth.api.sonyentertainmentnetwork.com/2.0/oauth/authorize?") ||
		!strings.Contains(u, "client_id=ba495a24") || !strings.Contains(u, "response_type=code") {
		t.Fatalf("login URL inesperada: %s", u)
	}
}
