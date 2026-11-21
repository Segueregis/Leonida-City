// Package grant valida os grants de sessão emitidos pela plataforma (JWT EdDSA/Ed25519).
//
// O relay só aceita conexões com um grant válido e corta a sessão no exp usando o
// relógio monotônico local — mesmo que a plataforma esteja fora do ar.
package grant

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims do grant. sid = id da GameSession, cid = id do Console.
type Claims struct {
	SessionID string `json:"sid"`
	ConsoleID string `json:"cid"`
	jwt.RegisteredClaims
}

// Verify valida assinatura, algoritmo, exp e campos obrigatórios.
func Verify(token string, pub ed25519.PublicKey, now time.Time) (*Claims, error) {
	c := &Claims{}
	_, err := jwt.ParseWithClaims(token, c,
		func(t *jwt.Token) (any, error) { return pub, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodEdDSA.Alg()}),
		jwt.WithExpirationRequired(),
		jwt.WithTimeFunc(func() time.Time { return now }),
	)
	if err != nil {
		return nil, fmt.Errorf("grant inválido: %w", err)
	}
	if c.SessionID == "" || c.ConsoleID == "" || c.ID == "" {
		return nil, errors.New("grant inválido: sid, cid e jti são obrigatórios")
	}
	return c, nil
}

// Mint emite um grant (usado pela plataforma; aqui para testes e para o spike).
func Mint(priv ed25519.PrivateKey, sessionID, consoleID string, ttl time.Duration, now time.Time) (string, error) {
	jti := make([]byte, 16)
	if _, err := rand.Read(jti); err != nil {
		return "", err
	}
	c := Claims{
		SessionID: sessionID,
		ConsoleID: consoleID,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        base64.RawURLEncoding.EncodeToString(jti),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodEdDSA, c).SignedString(priv)
}

// ParsePublicKey / ParsePrivateKey aceitam as chaves em base64 padrão (formato do `relay keygen`).
func ParsePublicKey(b64 string) (ed25519.PublicKey, error) {
	b, err := base64.StdEncoding.DecodeString(b64)
	if err != nil || len(b) != ed25519.PublicKeySize {
		return nil, errors.New("chave pública Ed25519 inválida")
	}
	return ed25519.PublicKey(b), nil
}

func ParsePrivateKey(b64 string) (ed25519.PrivateKey, error) {
	b, err := base64.StdEncoding.DecodeString(b64)
	if err != nil || len(b) != ed25519.PrivateKeySize {
		return nil, errors.New("chave privada Ed25519 inválida")
	}
	return ed25519.PrivateKey(b), nil
}
