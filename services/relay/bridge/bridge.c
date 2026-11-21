// chiaki-bridge — ponte headless entre um PS5 (Remote Play via PSN) e o relay LeonidaPlay.
// SPDX-License-Identifier: AGPL-3.0-only  (linka libchiaki/chiaki-ng, AGPLv3)
//
// Modos:
//   chiaki-bridge list
//       Lista os PS5 da conta PSN (duid, nome). Token em CHIAKI_PSN_TOKEN.
//   chiaki-bridge run --duid HEX --account-id B64 [--socket PATH] [--dump ARQ.h264]
//                     [--res 1080|720|540] [--fps 60|30] [--bitrate KBPS]
//       Conecta via holepunch PSN e repassa vídeo H.264 / áudio Opus SEM decodificar.
//       --socket: protocolo em PROTOCOL.md (relay Go).  --dump: grava Annex-B para ffplay.
//
// O token PSN nunca é aceito via argv (apareceria no `ps`).

#include <arpa/inet.h> // antes do holepunch.h (usa INET6_ADDRSTRLEN)
#include <netinet/in.h>

#include <chiaki/base64.h>
#include <chiaki/common.h>
#include <chiaki/controller.h>
#include <chiaki/log.h>
#include <chiaki/remote/holepunch.h>
#include <chiaki/session.h>

#include <arpa/inet.h>
#include <errno.h>
#include <pthread.h>
#include <signal.h>
#include <stdatomic.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>

enum {
	MSG_VIDEO = 0x01,
	MSG_AUDIO = 0x02,
	MSG_AUDIO_HEADER = 0x03,
	MSG_EVENT = 0x04,
	MSG_CONTROLLER = 0x10,
	MSG_REQUEST_IDR = 0x11,
	MSG_STOP = 0x12,
};

// Botões que o jogador nunca pode apertar (menu do sistema / captura).
#define BLOCKED_BUTTONS (CHIAKI_CONTROLLER_BUTTON_PS | CHIAKI_CONTROLLER_BUTTON_SHARE)

typedef struct {
	ChiakiSession session;
	ChiakiLog log;
	int sock; // -1 se não houver relay
	FILE *dump; // NULL se não houver dump
	pthread_mutex_t write_mtx;
	atomic_bool quit;
	atomic_uint_fast64_t frames;
} Bridge;

static Bridge g;

// ---------------------------------------------------------------------------
// I/O com framing
// ---------------------------------------------------------------------------

static bool write_all(int fd, const void *buf, size_t n) {
	const uint8_t *p = buf;
	while (n > 0) {
		ssize_t w = write(fd, p, n);
		if (w < 0) {
			if (errno == EINTR) continue;
			return false;
		}
		p += w;
		n -= (size_t)w;
	}
	return true;
}

static bool read_all(int fd, void *buf, size_t n) {
	uint8_t *p = buf;
	while (n > 0) {
		ssize_t r = read(fd, p, n);
		if (r == 0) return false;
		if (r < 0) {
			if (errno == EINTR) continue;
			return false;
		}
		p += r;
		n -= (size_t)r;
	}
	return true;
}

// Envia [type][len][prefix][body] atomicamente (callbacks rodam em threads da lib).
static void send_msg(uint8_t type, const void *prefix, size_t prefix_len, const void *body, size_t body_len) {
	if (g.sock < 0) return;
	uint8_t hdr[5];
	uint32_t len = htonl((uint32_t)(prefix_len + body_len));
	hdr[0] = type;
	memcpy(hdr + 1, &len, 4);
	pthread_mutex_lock(&g.write_mtx);
	bool ok = write_all(g.sock, hdr, sizeof(hdr)) && (!prefix_len || write_all(g.sock, prefix, prefix_len)) &&
	          (!body_len || write_all(g.sock, body, body_len));
	pthread_mutex_unlock(&g.write_mtx);
	// Nunca chamar chiaki_session_stop dentro de callback da lib: só sinaliza; o loop principal encerra.
	if (!ok && !atomic_exchange(&g.quit, true)) CHIAKI_LOGE(&g.log, "relay socket closed, stopping session");
}

static void send_event(const char *json) { send_msg(MSG_EVENT, NULL, 0, json, strlen(json)); }

// ---------------------------------------------------------------------------
// Callbacks da libchiaki
// ---------------------------------------------------------------------------

static bool video_cb(uint8_t *buf, size_t buf_size, int32_t frames_lost, bool frame_recovered, void *user) {
	(void)user;
	atomic_fetch_add(&g.frames, 1);
	if (g.dump) fwrite(buf, 1, buf_size, g.dump);
	uint8_t prefix[5];
	uint32_t fl = htonl((uint32_t)frames_lost);
	memcpy(prefix, &fl, 4);
	prefix[4] = frame_recovered ? 1 : 0;
	send_msg(MSG_VIDEO, prefix, sizeof(prefix), buf, buf_size);
	return true;
}

static void audio_header_cb(ChiakiAudioHeader *h, void *user) {
	(void)user;
	uint8_t p[9];
	uint32_t rate = htonl(h->rate), fs = htonl(h->frame_size);
	p[0] = h->channels;
	memcpy(p + 1, &rate, 4);
	memcpy(p + 5, &fs, 4);
	send_msg(MSG_AUDIO_HEADER, NULL, 0, p, sizeof(p));
}

static void audio_frame_cb(uint8_t *buf, size_t buf_size, void *user) {
	(void)user;
	send_msg(MSG_AUDIO, NULL, 0, buf, buf_size);
}

static void event_cb(ChiakiEvent *ev, void *user) {
	(void)user;
	char json[256];
	switch (ev->type) {
		case CHIAKI_EVENT_CONNECTED:
			CHIAKI_LOGI(&g.log, "connected to console");
			send_event("{\"event\":\"connected\"}");
			break;
		case CHIAKI_EVENT_LOGIN_PIN_REQUEST:
			// A conta secundária não deve ter PIN de login; sem PIN não há como seguir.
			send_event("{\"event\":\"login_pin_request\"}");
			atomic_store(&g.quit, true);
			break;
		case CHIAKI_EVENT_HOLEPUNCH:
			snprintf(json, sizeof(json), "{\"event\":\"holepunch\",\"finished\":%s}",
			         ev->data_holepunch.finished ? "true" : "false");
			send_event(json);
			break;
		case CHIAKI_EVENT_QUIT:
			snprintf(json, sizeof(json), "{\"event\":\"quit\",\"reason\":\"%s\"}",
			         chiaki_quit_reason_string(ev->quit.reason));
			CHIAKI_LOGI(&g.log, "session quit: %s", chiaki_quit_reason_string(ev->quit.reason));
			send_event(json);
			atomic_store(&g.quit, true);
			break;
		default:
			break;
	}
}

// ---------------------------------------------------------------------------
// Leitura de comandos do relay
// ---------------------------------------------------------------------------

static int16_t be16(const uint8_t *p) { return (int16_t)((p[0] << 8) | p[1]); }
static uint32_t be32(const uint8_t *p) {
	return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) | ((uint32_t)p[2] << 8) | p[3];
}

static void *relay_reader(void *arg) {
	(void)arg;
	ChiakiControllerState st;
	chiaki_controller_state_set_idle(&st);
	uint8_t hdr[5], payload[64];
	while (!atomic_load(&g.quit)) {
		if (!read_all(g.sock, hdr, sizeof(hdr))) break;
		uint32_t len = be32(hdr + 1);
		if (len > sizeof(payload)) {
			CHIAKI_LOGE(&g.log, "relay message too large (%u)", len);
			break;
		}
		if (len && !read_all(g.sock, payload, len)) break;
		switch (hdr[0]) {
			case MSG_CONTROLLER:
				if (len != 16) break;
				st.buttons = be32(payload) & ~(uint32_t)BLOCKED_BUTTONS;
				st.l2_state = payload[4];
				st.r2_state = payload[5];
				st.left_x = be16(payload + 6);
				st.left_y = be16(payload + 8);
				st.right_x = be16(payload + 10);
				st.right_y = be16(payload + 12);
				chiaki_session_set_controller_state(&g.session, &st);
				break;
			case MSG_REQUEST_IDR:
				chiaki_session_request_idr(&g.session);
				break;
			case MSG_STOP:
				CHIAKI_LOGI(&g.log, "STOP from relay");
				goto out;
			default:
				break;
		}
	}
out:
	// Socket fechado ou STOP: corte imediato (fim do tempo).
	atomic_store(&g.quit, true);
	chiaki_session_stop(&g.session);
	return NULL;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

static bool parse_hex(const char *hex, uint8_t *out, size_t out_len) {
	if (strlen(hex) != out_len * 2) return false;
	for (size_t i = 0; i < out_len; i++) {
		unsigned v;
		if (sscanf(hex + 2 * i, "%2x", &v) != 1) return false;
		out[i] = (uint8_t)v;
	}
	return true;
}

static int connect_unix(const char *path) {
	int fd = socket(AF_UNIX, SOCK_STREAM, 0);
	if (fd < 0) return -1;
	struct sockaddr_un addr = {.sun_family = AF_UNIX};
	if (strlen(path) >= sizeof(addr.sun_path)) {
		close(fd);
		return -1;
	}
	strcpy(addr.sun_path, path);
	if (connect(fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
		close(fd);
		return -1;
	}
	return fd;
}

static const char *arg(int argc, char **argv, const char *name) {
	for (int i = 2; i < argc - 1; i++)
		if (!strcmp(argv[i], name)) return argv[i + 1];
	return NULL;
}

static void on_signal(int sig) {
	(void)sig;
	atomic_store(&g.quit, true);
}

static void usage(void) {
	fprintf(stderr,
	        "uso:\n"
	        "  CHIAKI_PSN_TOKEN=... chiaki-bridge list\n"
	        "  CHIAKI_PSN_TOKEN=... chiaki-bridge run --duid HEX --account-id B64 [--socket PATH] [--dump ARQ.h264]\n"
	        "                       [--res 1080|720|540] [--fps 60|30] [--bitrate KBPS]\n");
}

// ---------------------------------------------------------------------------
// Modos
// ---------------------------------------------------------------------------

static int cmd_list(const char *token) {
	ChiakiHolepunchDeviceInfo *devices = NULL;
	size_t count = 0;
	ChiakiErrorCode err = chiaki_holepunch_list_devices(token, CHIAKI_HOLEPUNCH_CONSOLE_TYPE_PS5, &devices, &count, &g.log);
	if (err != CHIAKI_ERR_SUCCESS) {
		fprintf(stderr, "list_devices falhou: %s\n", chiaki_error_string(err));
		return 1;
	}
	for (size_t i = 0; i < count; i++) {
		printf("{\"name\":\"%s\",\"duid\":\"", devices[i].device_name);
		for (size_t b = 0; b < sizeof(devices[i].device_uid); b++) printf("%02x", devices[i].device_uid[b]);
		printf("\",\"remoteplay_enabled\":%s}\n", devices[i].remoteplay_enabled ? "true" : "false");
	}
	chiaki_holepunch_free_device_list(&devices);
	return 0;
}

static int cmd_run(int argc, char **argv, const char *token) {
	const char *duid_hex = arg(argc, argv, "--duid");
	const char *account_b64 = arg(argc, argv, "--account-id");
	const char *sock_path = arg(argc, argv, "--socket");
	const char *dump_path = arg(argc, argv, "--dump");
	const char *res_s = arg(argc, argv, "--res");
	const char *fps_s = arg(argc, argv, "--fps");
	const char *bitrate_s = arg(argc, argv, "--bitrate");
	if (!duid_hex || !account_b64 || (!sock_path && !dump_path)) {
		usage();
		return 2;
	}

	uint8_t duid[32];
	if (!parse_hex(duid_hex, duid, sizeof(duid))) {
		fprintf(stderr, "duid inválido (esperado 64 hex)\n");
		return 2;
	}

	ChiakiConnectInfo ci;
	memset(&ci, 0, sizeof(ci));
	ci.ps5 = true;
	ci.host = "psn"; // não usado no caminho holepunch
	size_t acc_len = sizeof(ci.psn_account_id);
	if (chiaki_base64_decode(account_b64, strlen(account_b64), ci.psn_account_id, &acc_len) != CHIAKI_ERR_SUCCESS ||
	    acc_len != CHIAKI_PSN_ACCOUNT_ID_SIZE) {
		fprintf(stderr, "account-id inválido (8 bytes em base64)\n");
		return 2;
	}

	int res = res_s ? atoi(res_s) : 1080;
	ChiakiVideoResolutionPreset rp = res >= 1080 ? CHIAKI_VIDEO_RESOLUTION_PRESET_1080p
	                                 : res >= 720 ? CHIAKI_VIDEO_RESOLUTION_PRESET_720p
	                                              : CHIAKI_VIDEO_RESOLUTION_PRESET_540p;
	chiaki_connect_video_profile_preset(&ci.video_profile, rp,
	                                    (fps_s && atoi(fps_s) == 30) ? CHIAKI_VIDEO_FPS_PRESET_30 : CHIAKI_VIDEO_FPS_PRESET_60);
	if (bitrate_s) ci.video_profile.bitrate = (unsigned)atoi(bitrate_s);
	ci.video_profile.codec = CHIAKI_CODEC_H264; // único codec com suporte universal no WebRTC
	ci.video_profile_auto_downgrade = true;
	ci.enable_idr_on_fec_failure = true;
	ci.packet_loss_max = 0.05;

	if (dump_path && !(g.dump = fopen(dump_path, "wb"))) {
		perror("dump");
		return 1;
	}
	if (sock_path && (g.sock = connect_unix(sock_path)) < 0) {
		perror("socket do relay");
		return 1;
	}

	ChiakiHolepunchSession hp = chiaki_holepunch_session_init(token, &g.log);
	if (!hp) {
		fprintf(stderr, "holepunch_session_init falhou\n");
		return 1;
	}
	ci.holepunch_session = hp;

	ChiakiErrorCode err = chiaki_session_init(&g.session, &ci, &g.log);
	if (err != CHIAKI_ERR_SUCCESS) {
		fprintf(stderr, "session_init falhou: %s\n", chiaki_error_string(err));
		return 1;
	}
	chiaki_session_set_event_cb(&g.session, event_cb, NULL);
	chiaki_session_set_video_sample_cb(&g.session, video_cb, NULL);
	ChiakiAudioSink sink = {.user = NULL, .header_cb = audio_header_cb, .frame_cb = audio_frame_cb};
	chiaki_session_set_audio_sink(&g.session, &sink);

	// Sequência igual à do chiaki-ng GUI: UPnP → sessão PSN → oferta → start → furar NAT (ctrl)
	if ((err = chiaki_holepunch_upnp_discover(hp)) != CHIAKI_ERR_SUCCESS ||
	    (err = chiaki_holepunch_session_create(hp)) != CHIAKI_ERR_SUCCESS ||
	    (err = holepunch_session_create_offer(hp)) != CHIAKI_ERR_SUCCESS ||
	    (err = chiaki_holepunch_session_start(hp, duid, CHIAKI_HOLEPUNCH_CONSOLE_TYPE_PS5)) != CHIAKI_ERR_SUCCESS ||
	    (err = chiaki_holepunch_session_punch_hole(hp, CHIAKI_HOLEPUNCH_PORT_TYPE_CTRL)) != CHIAKI_ERR_SUCCESS) {
		fprintf(stderr, "conexão PSN falhou: %s\n", chiaki_error_string(err));
		char json[128];
		snprintf(json, sizeof(json), "{\"event\":\"psn_connect_failed\",\"error\":\"%s\"}", chiaki_error_string(err));
		send_event(json);
		chiaki_session_fini(&g.session);
		return 3;
	}

	if ((err = chiaki_session_start(&g.session)) != CHIAKI_ERR_SUCCESS) {
		fprintf(stderr, "session_start falhou: %s\n", chiaki_error_string(err));
		chiaki_session_fini(&g.session);
		return 1;
	}

	pthread_t reader;
	bool has_reader = g.sock >= 0 && pthread_create(&reader, NULL, relay_reader, NULL) == 0;

	// Sem relay (modo dump): roda até Ctrl+C.
	while (!atomic_load(&g.quit)) usleep(20 * 1000);

	chiaki_session_stop(&g.session);
	chiaki_session_join(&g.session);
	if (g.sock >= 0) shutdown(g.sock, SHUT_RDWR);
	if (has_reader) pthread_join(reader, NULL);
	chiaki_session_fini(&g.session);
	if (g.dump) fclose(g.dump);
	fprintf(stderr, "frames recebidos: %llu\n", (unsigned long long)atomic_load(&g.frames));
	return 0;
}

int main(int argc, char **argv) {
	if (argc < 2) {
		usage();
		return 2;
	}
	g.sock = -1;
	pthread_mutex_init(&g.write_mtx, NULL);
	signal(SIGINT, on_signal);
	signal(SIGTERM, on_signal);
	signal(SIGPIPE, SIG_IGN);

	const char *token = getenv("CHIAKI_PSN_TOKEN");
	if (!token || !*token) {
		fprintf(stderr, "defina CHIAKI_PSN_TOKEN (token OAuth PSN da conta secundária)\n");
		return 2;
	}

	if (chiaki_lib_init() != CHIAKI_ERR_SUCCESS) {
		fprintf(stderr, "chiaki_lib_init falhou\n");
		return 1;
	}
	chiaki_log_init(&g.log, CHIAKI_LOG_ALL & ~CHIAKI_LOG_VERBOSE, chiaki_log_cb_print, NULL);

	if (!strcmp(argv[1], "list")) return cmd_list(token);
	if (!strcmp(argv[1], "run")) return cmd_run(argc, argv, token);
	usage();
	return 2;
}
