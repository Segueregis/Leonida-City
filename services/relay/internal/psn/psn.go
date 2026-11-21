// Package psn implementa o login OAuth da PSN usado pelo Remote Play (mesmo fluxo do chiaki-ng).
//
// O token resultante tem escopo restrito ao Remote Play (psn:clientapp,
// remotePlaySession.system.update ...) — não dá acesso à loja nem à senha da conta.
// Este é o fluxo do onboarding do anfitrião, com a conta SECUNDÁRIA do PS5.
package psn

import (
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Credenciais públicas do cliente Remote Play (as mesmas do app oficial / chiaki-ng).
const (
	clientID     = "ba495a24-818c-472b-b12d-ff231c1b5745"
	clientSecret = "mvaiZkRsAsI1IBkY"
	tokenURL     = "https://auth.api.sonyentertainmentnetwork.com/2.0/oauth/token"
	redirectURI  = "https://remoteplay.dl.playstation.net/remoteplay/redirect"
	scope        = "psn:clientapp referenceDataService:countryConfig.read pushNotification:webSocket.desktop.connect sessionManager:remotePlaySession.system.update"
)

// LoginURL: o anfitrião abre, entra com a conta secundária e é redirecionado para
// remoteplay.dl.playstation.net/...?code=XXXX — ele cola essa URL de volta.
func LoginURL() string {
	q := url.Values{
		"service_entity":     {"urn:service-entity:psn"},
		"response_type":      {"code"},
		"client_id":          {clientID},
		"redirect_uri":       {redirectURI},
		"scope":              {scope},
		"request_locale":     {"pt_BR"},
		"ui":                 {"pr"},
		"service_logo":       {"ps"},
		"layout_type":        {"popup"},
		"smcid":              {"remoteplay"},
		"prompt":             {"always"},
		"PlatformPrivacyWs1": {"minimal"},
	}
	return "https://auth.api.sonyentertainmentnetwork.com/2.0/oauth/authorize?" + q.Encode()
}

// CodeFromRedirect extrai o "code" da URL de redirecionamento colada pelo anfitrião.
// Aceita também só o código (caso o navegador não copie a URL inteira).
func CodeFromRedirect(input string) (string, error) {
	in := strings.TrimSpace(input)
	if in == "" {
		return "", errors.New("nada foi colado")
	}
	if !strings.Contains(in, "://") {
		if strings.ContainsAny(in, " ?&=/") {
			return "", errors.New("isso não parece nem a URL nem o código")
		}
		return in, nil // só o código
	}
	u, err := url.Parse(in)
	if err != nil {
		return "", err
	}
	if !strings.HasPrefix(u.Scheme+"://"+u.Host+u.Path, redirectURI) {
		return "", errors.New("URL não é o redirecionamento do Remote Play")
	}
	q := u.Query()
	if e := q.Get("error"); e != "" {
		return "", fmt.Errorf("a Sony recusou o login (%s) — tente de novo", e)
	}
	if code := q.Get("code"); code != "" {
		return code, nil
	}
	names := make([]string, 0, len(q))
	for k := range q {
		names = append(names, k)
	}
	return "", fmt.Errorf("a URL chegou sem o valor do code (parâmetros recebidos: %v) — a cópia veio cortada", names)
}

type Token struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresIn    int       `json:"expires_in"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type Client struct {
	HTTP *http.Client
}

func (c *Client) http() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return &http.Client{Timeout: 15 * time.Second}
}

// Exchange troca o code por access + refresh token.
func (c *Client) Exchange(ctx context.Context, code string) (*Token, error) {
	return c.tokenRequest(ctx, url.Values{"grant_type": {"authorization_code"}, "code": {code},
		"scope": {scope}, "redirect_uri": {redirectURI}})
}

// Refresh renova o access token (o relay faz isso antes de cada sessão).
func (c *Client) Refresh(ctx context.Context, refreshToken string) (*Token, error) {
	return c.tokenRequest(ctx, url.Values{"grant_type": {"refresh_token"}, "refresh_token": {refreshToken},
		"scope": {scope}, "redirect_uri": {redirectURI}})
}

func (c *Client) tokenRequest(ctx context.Context, form url.Values) (*Token, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(clientID, clientSecret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var t Token
	if err := c.do(req, &t); err != nil {
		return nil, err
	}
	if t.AccessToken == "" {
		return nil, errors.New("PSN não retornou access_token")
	}
	t.ExpiresAt = time.Now().Add(time.Duration(t.ExpiresIn) * time.Second)
	return &t, nil
}

// AccountID devolve o PSN account id (8 bytes little-endian em base64), exigido pelo Remote Play.
func (c *Client) AccountID(ctx context.Context, accessToken string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, tokenURL+"/"+url.PathEscape(accessToken), nil)
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(clientID, clientSecret)
	var info struct {
		UserID string `json:"user_id"`
	}
	if err := c.do(req, &info); err != nil {
		return "", err
	}
	return EncodeAccountID(info.UserID)
}

// EncodeAccountID converte o user_id decimal no formato do Remote Play.
func EncodeAccountID(userID string) (string, error) {
	n, err := strconv.ParseUint(userID, 10, 64)
	if err != nil {
		return "", fmt.Errorf("user_id inválido: %w", err)
	}
	b := make([]byte, 8)
	binary.LittleEndian.PutUint64(b, n)
	return base64.StdEncoding.EncodeToString(b), nil
}

func (c *Client) do(req *http.Request, out any) error {
	resp, err := c.http().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("PSN respondeu HTTP %d", resp.StatusCode) // corpo omitido: pode conter dados da conta
	}
	return json.Unmarshal(body, out)
}
