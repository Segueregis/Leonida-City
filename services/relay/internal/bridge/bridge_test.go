package bridge

import (
	"bytes"
	"testing"
)

func TestFramingRoundTrip(t *testing.T) {
	var buf bytes.Buffer
	if err := WriteMsg(&buf, MsgController, []byte{1, 2, 3}); err != nil {
		t.Fatal(err)
	}
	if err := WriteMsg(&buf, MsgStop, nil); err != nil {
		t.Fatal(err)
	}
	m, err := ReadMsg(&buf)
	if err != nil || m.Type != MsgController || !bytes.Equal(m.Payload, []byte{1, 2, 3}) {
		t.Fatalf("msg 1 errada: %+v %v", m, err)
	}
	m, err = ReadMsg(&buf)
	if err != nil || m.Type != MsgStop || len(m.Payload) != 0 {
		t.Fatalf("msg 2 errada: %+v %v", m, err)
	}
}

func TestReadMsgRejectsHugePayload(t *testing.T) {
	hdr := []byte{MsgVideo, 0xff, 0xff, 0xff, 0xff}
	if _, err := ReadMsg(bytes.NewReader(hdr)); err == nil {
		t.Fatal("payload de 4 GB aceito")
	}
}
