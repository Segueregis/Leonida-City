# services/relay — ponte PS5 → navegador (spike F0)

```
PS5 ──Remote Play via PSN──► chiaki-bridge (C, libchiaki) ──unix socket──► relay (Go, Pion) ──WebRTC──► navegador
```

- `bridge/` — `chiaki-bridge` em C sobre a libchiaki do chiaki-ng (**AGPLv3**: este código deve ser publicado). Protocolo em `bridge/PROTOCOL.md`.
- `cmd/relay` — servidor Go: grants Ed25519, um jogador por console, filtro de botões, corte no `exp`, PLI → keyframe, página de teste embutida.
- `internal/psn` — login OAuth da PSN (escopo só Remote Play), refresh e account id.
- `third_party/chiaki-ng` — clone do chiaki-ng (ignorado pelo git).

## Build (macOS)

```bash
brew install go cmake miniupnpc opus openssl@3 json-c pkgconf ffmpeg
git clone --depth 1 --recurse-submodules --shallow-submodules https://github.com/streetpea/chiaki-ng.git third_party/chiaki-ng
printf 'module thirdparty_ignored\n\ngo 1.27\n' > third_party/go.mod
python3 -m venv .venv-build && .venv-build/bin/pip install protobuf grpcio-tools
PATH="$PWD/.venv-build/bin:$PATH" cmake -S bridge -B build/bridge -DCMAKE_BUILD_TYPE=Release -DOPENSSL_ROOT_DIR=/opt/homebrew/opt/openssl@3
PATH="$PWD/.venv-build/bin:$PATH" cmake --build build/bridge -j8 --target chiaki-bridge
go test ./... && go build -o bin/relay ./cmd/relay
```

## Teste sem PS5 (modo simulado)

```bash
ffmpeg -f lavfi -i "testsrc2=size=1280x720:rate=60" -t 10 -c:v libx264 -profile:v baseline -bf 0 -g 120 \
  -pix_fmt yuv420p -tune zerolatency -bsf:v h264_mp4toannexb build/testdata/test720p60.h264
./bin/relay keygen > build/testdata/keys.env && set -a && . build/testdata/keys.env && set +a
./bin/relay serve -addr 127.0.0.1:8080 -fake build/testdata/test720p60.h264 -stun ""
./bin/relay mint-grant -seconds 75     # cole o grant em http://127.0.0.1:8080
```

## Teste com o PS5 real

1. No PS5, com a **conta secundária**: Configurações → Sistema → Uso remoto → ativar Remote Play; Economia de energia → modo repouso: "Manter conectado à internet" e "Ligar o PS5 pela rede".
2. `./bin/relay psn-login` — abre o login da Sony, cole a URL de retorno. Salva `build/psn-secondary.json` (0600).
3. `./bin/relay psn-devices` — mostra o `duid` do PS5.
4. `./bin/relay serve -psn-file build/psn-secondary.json -duid <DUID>` e conecte pelo navegador com um grant.
5. Para o critério de CGNAT: ligue o PS5 no hotspot 4G do celular e repita.
