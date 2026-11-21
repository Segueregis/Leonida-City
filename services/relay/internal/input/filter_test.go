package input

import (
	"encoding/binary"
	"testing"
)

func TestSanitizeBlocksSystemButtons(t *testing.T) {
	in := make([]byte, StateSize)
	const cross = 1 << 0
	binary.BigEndian.PutUint32(in, cross|ButtonPS|ButtonShare)
	in[4], in[5] = 200, 100 // gatilhos preservados
	binary.BigEndian.PutUint16(in[6:], 0x7fff)

	out, err := Sanitize(in)
	if err != nil {
		t.Fatal(err)
	}
	if got := binary.BigEndian.Uint32(out); got != cross {
		t.Fatalf("botões = %#x, esperado só CROSS", got)
	}
	if out[4] != 200 || out[5] != 100 || binary.BigEndian.Uint16(out[6:]) != 0x7fff {
		t.Fatal("analógicos/gatilhos alterados")
	}
	if binary.BigEndian.Uint32(in)&ButtonPS == 0 {
		t.Fatal("entrada original não deveria ser modificada")
	}
}

func TestSanitizeRejectsBadSize(t *testing.T) {
	for _, n := range []int{0, 15, 17, 64} {
		if _, err := Sanitize(make([]byte, n)); err == nil {
			t.Errorf("tamanho %d aceito", n)
		}
	}
}
