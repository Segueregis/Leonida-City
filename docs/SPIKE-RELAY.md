# F0 — Spike do Relay (1–2 semanas)

**Objetivo:** provar que um servidor na nuvem consegue jogar num PS5 doméstico atrás de CGNAT e entregar o vídeo a um navegador com latência jogável. **Se o spike falhar, o restante do projeto não começa.**

## Critérios de sucesso (go / no-go)

| # | Critério | Meta |
|---|---|---|
| 1 | Relay (Oracle Cloud SP) conecta ao PS5 via Remote Play pela PSN, **sem port forwarding**, com o PS5 numa rede CGNAT | Conecta em ≥ 9 de 10 tentativas |
| 2 | Vídeo H.264 do PS5 repassado ao navegador via WebRTC **sem transcodificar** | 1080p60, 10–15 Mbps |
| 3 | Latência ponta a ponta (input → reação na tela do jogador) | **p50 < 80 ms**, p95 < 120 ms (jogador na mesma região) |
| 4 | Input do navegador (Gamepad API) chega ao PS5; botão PS e Create bloqueados | 100% dos botões bloqueados ignorados |
| 5 | Corte no `exp` do grant com o servidor web **desligado** | Corte em ≤ 1 s do `exp` |
| 6 | Recuperação após perda de pacotes (keyframe) | Imagem volta em < 2 s com 2% de perda simulada |
| 7 | Acordar o PS5 do modo repouso pelo relay | Funciona sem ninguém tocar no console |
| 8 | Custo medido | GB/hora e CPU por sessão registrados |

## Pré-requisitos

- Um PS5 com qualquer jogo (não precisa ser o GTA 6 para o spike).
- **Rede CGNAT para o PS5**: o jeito mais fácil é rotear o PS5 por um **hotspot 4G/5G do celular** (operadoras móveis usam CGNAT).
- Conta Oracle Cloud com VM na região **São Paulo** (Ampere A1 serve para o spike).
- Go instalado localmente: `brew install go` (não está instalado nesta máquina hoje).
- Conta PSN secundária no PS5 (a mesma que o MVP usará).

## Arquitetura do spike

```
PS5 ──Remote Play/PSN──► [chiaki-bridge (C, libchiaki)] ──unix socket──► [relay (Go, Pion)] ──WebRTC──► navegador
                          · login PSN / registro (PIN)    · NALUs H.264        · TrackLocalStaticSample
                          · decifra stream                · estado do controle  · DataChannel de input
                          · injeta controle                                     · filtro de botões / exp
```

- **chiaki-bridge**: programa C mínimo sobre a `libchiaki` do chiaki-ng. Responsabilidades: sessão Remote Play (incluindo conexão remota via PSN), saída de NALUs H.264 Annex-B no socket, entrada de estado do controle pelo socket, pedido de keyframe.
  - ⚠️ **Validar no dia 1**: versão do chiaki-ng que suporta conexão remota via PSN (holepunch), e se a `libchiaki` expõe isso sem a UI Qt.
- **relay (Go)**: Pion WebRTC. Lê NALUs e escreve em `TrackLocalStaticSample` (H.264). Recebe input pelo DataChannel, aplica o filtro e repassa ao bridge. Valida grant Ed25519 e corta no `exp`.
- **Página de teste**: HTML estático com `RTCPeerConnection`, `<video>`, Gamepad API e medição de RTT. Sinalização por HTTP simples (sem Next.js no spike).

## Roteiro

| Dia | Tarefa |
|---|---|
| 1 | Compilar chiaki-ng, jogar localmente pela LAN. Registrar o PS5 (PIN). Confirmar conexão remota via PSN pelo app oficial do chiaki-ng a partir do 4G. |
| 2–3 | chiaki-bridge: sessão headless + dump de H.264 em arquivo (abrir no ffplay para validar). |
| 4–5 | relay Go: WebRTC com vídeo para o navegador em LAN. |
| 6 | Input: Gamepad API → DataChannel → bridge → PS5. Filtro de botões. |
| 7 | Subir na Oracle SP; PS5 no hotspot 4G. Medir conexão (critério 1). |
| 8 | Medir latência ponta a ponta: filmar em câmera lenta (240 fps) o controle e a tela do jogador; contar frames. |
| 9 | Grant Ed25519 + corte no `exp` com servidor desligado. Perda simulada (`tc netem`) e recuperação de keyframe. |
| 10 | Wake do modo repouso, medição de banda/CPU, relatório go/no-go. |

## Planos B

| Falha | Alternativa | Custo |
|---|---|---|
| Holepunch PSN falha atrás de CGNAT | Agente no PC/mini PC do anfitrião (rede local), WebRTC até o relay | Anfitrião precisa de hardware → revisar decisão "só PS5" |
| Repasse sem transcodificar não funciona no navegador | Transcodificar com GPU (NVENC) | VM com GPU — custo por sessão sobe bastante |
| Latência > 80 ms pelo desvio até SP | Relays regionais (Nordeste) antes do lançamento | Mais uma VM por região |

## Licença

`libchiaki` é **AGPLv3**. O código do chiaki-bridge e do relay que o usa deve ser publicado (repositório público separado). O resto da plataforma (web, ledger) não linka a biblioteca.

---

## Resultados — dias 1 a 3 (21/11/2026, sem PS5)

### Descobertas na libchiaki (chiaki-ng `43728af`, 03/11/2026)

| Pergunta | Resposta |
|---|---|
| A conexão remota via PSN funciona sem a UI Qt? | **Sim.** `chiaki_holepunch_*` é API C pública da `libchiaki`. Sequência: `session_init(token)` → `chiaki_session_init` → `upnp_discover` → `session_create` → `create_offer` → `session_start(duid)` → `punch_hole(CTRL)` → `chiaki_session_start`. |
| Dá para repassar o vídeo sem transcodificar? | **Sim.** `video_sample_cb` entrega o frame **já codificado** (H.264/H.265). O áudio chega como **Opus cru** no `ChiakiAudioSink` — o WebRTC usa Opus nativamente, sem decodificar nada. |
| Recuperação de keyframe? | `chiaki_session_request_idr()` existe. O relay converte PLI/FIR do navegador em pedido de IDR (limitado a 1 a cada 500 ms). |
| Precisa de PIN / registro no PS5? | **Não pelo caminho PSN.** O registro é automático via holepunch. O anfitrião só faz login da conta secundária na Sony. Onboarding mais simples que o previsto. |
| O que guardamos do anfitrião? | `accountId` (8 bytes) + `refreshToken` PSN + `duid` do PS5. Escopo do token: só Remote Play (`psn:clientapp`, `remotePlaySession.system.update`…) — **não** acessa loja nem senha. |

### O que foi construído

- `chiaki-bridge` (C) compilado contra a libchiaki headless no macOS. Contra a Sony real: com token inválido recebe **HTTP 401** do endpoint de dispositivos — caminho de rede ok, falta só um token válido.
- `relay` (Go/Pion): grant Ed25519, um jogador por console, grant de uso único, filtro de botões PS/Create (relay **e** bridge), PLI → IDR, aviso T-60 s, corte no `exp`, `psn-login` / `psn-devices`, página de teste.
- Testes unitários: grant (expirado, outra chave, assinatura adulterada, `alg:none`, sem `exp`), filtro, framing, PSN.

### Teste ponta a ponta em modo simulado (H.264 720p60 no lugar do PS5, localhost)

| Verificação | Resultado |
|---|---|
| Vídeo no navegador (Chromium) | ✅ 60 fps, ~8 Mbps, 0% perda, 3711 frames em 62 s |
| Grant inválido | ✅ 401 |
| Reuso do mesmo grant | ✅ 409 "grant já utilizado" |
| Segundo jogador no mesmo console | ✅ 409 "console em uso" |
| Aviso T-60 s | ✅ 14:36:41 (exp 14:37:41) |
| Corte no `exp` | ✅ 14:37:41 exato; console liberado (`/sessions` vazio) |
| Input navegador → relay | ✅ 25 estados recebidos; pacote malformado descartado |

### Ainda não verificado (precisa do PS5)

Critérios 1, 3, 6, 7 e 8: conexão PSN atrás de CGNAT, latência ponta a ponta, recuperação com perda real, wake do modo repouso, custo de banda. Também: se o perfil H.264 que o PS5 envia (provavelmente High) decodifica no navegador mesmo negociado como `42e01f`.

### Próximo passo (dia 4 em diante — com você na frente do PS5)

```bash
cd services/relay
./bin/relay psn-login            # login da conta SECUNDÁRIA
./bin/relay psn-devices          # anota o duid
./bin/relay keygen > build/testdata/keys.env && set -a && . build/testdata/keys.env && set +a
./bin/relay serve -addr 127.0.0.1:8080 -psn-file build/psn-secondary.json -duid <DUID> -stun ""
./bin/relay mint-grant -seconds 300   # cole em http://127.0.0.1:8080
```
