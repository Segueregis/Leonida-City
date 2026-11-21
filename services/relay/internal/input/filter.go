// Package input valida e filtra o estado do controle enviado pelo navegador.
package input

import (
	"encoding/binary"
	"errors"
)

// Bits de botão (iguais ao ChiakiControllerButton da libchiaki).
const (
	ButtonShare uint32 = 1 << 13 // Create
	ButtonPS    uint32 = 1 << 15

	// Blocked: o jogador nunca pode abrir o menu do sistema nem a captura.
	Blocked = ButtonPS | ButtonShare

	// StateSize: buttons:u32, l2:u8, r2:u8, lx,ly,rx,ry:i16, 2 bytes reservados — tudo big-endian.
	StateSize = 16
)

var ErrBadSize = errors.New("estado do controle com tamanho inválido")

// Sanitize devolve uma cópia do estado com os botões bloqueados removidos.
func Sanitize(state []byte) ([]byte, error) {
	if len(state) != StateSize {
		return nil, ErrBadSize
	}
	out := make([]byte, StateSize)
	copy(out, state)
	buttons := binary.BigEndian.Uint32(out[0:4]) &^ Blocked
	binary.BigEndian.PutUint32(out[0:4], buttons)
	out[14], out[15] = 0, 0
	return out, nil
}
