package grant

import (
	"crypto/ed25519"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestMintVerify(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(nil)
	now := time.Unix(1_800_000_000, 0)
	tok, err := Mint(priv, "sess1", "cons1", 15*time.Minute, now)
	if err != nil {
		t.Fatal(err)
	}
	c, err := Verify(tok, pub, now.Add(14*time.Minute))
	if err != nil {
		t.Fatalf("válido rejeitado: %v", err)
	}
	if c.SessionID != "sess1" || c.ConsoleID != "cons1" || c.ID == "" {
		t.Fatalf("claims erradas: %+v", c)
	}
	if !c.ExpiresAt.Equal(now.Add(15 * time.Minute)) {
		t.Fatalf("exp errado: %v", c.ExpiresAt)
	}
}

func TestVerifyRejects(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(nil)
	otherPub, _, _ := ed25519.GenerateKey(nil)
	now := time.Unix(1_800_000_000, 0)
	tok, _ := Mint(priv, "s", "c", time.Minute, now)

	if _, err := Verify(tok, pub, now.Add(61*time.Second)); err == nil {
		t.Error("expirado aceito")
	}
	if _, err := Verify(tok, otherPub, now); err == nil {
		t.Error("assinatura de outra chave aceita")
	}
	parts := strings.Split(tok, ".")
	if _, err := Verify(parts[0]+"."+parts[1]+".AAAA", pub, now); err == nil {
		t.Error("assinatura adulterada aceita")
	}

	// alg "none" e HS256 não podem passar
	none, _ := jwt.NewWithClaims(jwt.SigningMethodNone, Claims{SessionID: "s", ConsoleID: "c",
		RegisteredClaims: jwt.RegisteredClaims{ID: "x", ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour))}}).
		SignedString(jwt.UnsafeAllowNoneSignatureType)
	if _, err := Verify(none, pub, now); err == nil {
		t.Error("alg none aceito")
	}

	// sem exp
	noExp, _ := jwt.NewWithClaims(jwt.SigningMethodEdDSA, Claims{SessionID: "s", ConsoleID: "c",
		RegisteredClaims: jwt.RegisteredClaims{ID: "x"}}).SignedString(priv)
	if _, err := Verify(noExp, pub, now); err == nil {
		t.Error("grant sem exp aceito")
	}
}
