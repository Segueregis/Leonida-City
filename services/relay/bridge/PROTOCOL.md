# Protocolo bridge ⇄ relay (unix socket)

O relay (Go) escuta num unix socket por sessão e inicia o `chiaki-bridge`, que conecta nele.
Cada mensagem: `type:u8 | len:u32 big-endian | payload[len]`.

## bridge → relay

| type | nome | payload |
|---|---|---|
| `0x01` | VIDEO | `frames_lost:i32 BE`, `recovered:u8`, frame H.264 Annex-B |
| `0x02` | AUDIO | 1 pacote Opus (sem decodificar) |
| `0x03` | AUDIO_HEADER | `channels:u8`, `rate:u32 BE`, `frame_size:u32 BE` |
| `0x04` | EVENT | JSON UTF-8 (`{"event":"connected"}`, `{"event":"quit","reason":"..."}`, `{"event":"login_pin_request"}`, `{"event":"holepunch","finished":true}`) |

## relay → bridge

| type | nome | payload |
|---|---|---|
| `0x10` | CONTROLLER | `buttons:u32 BE`, `l2:u8`, `r2:u8`, `lx:i16 BE`, `ly:i16 BE`, `rx:i16 BE`, `ry:i16 BE` (16 bytes) |
| `0x11` | REQUEST_IDR | vazio — navegador pediu keyframe (PLI) |
| `0x12` | STOP | vazio — encerra a sessão (fim do tempo / kill) |

## Segredos

O token PSN **nunca** vai em argv (visível no `ps`): o bridge lê de `CHIAKI_PSN_TOKEN` no ambiente,
injetado pelo relay a partir da credencial decifrada.

## Filtro

Os botões PS (`1<<15`) e Create/Share (`1<<13`) são removidos no relay **e** no bridge (defesa em profundidade).
