"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "../dictionaries";

// "Edição virtual" dos melhores trechos do vídeo, tocada pelo player oficial do YouTube
// (IFrame API: start/end + troca de trecho). Nada é baixado nem re-hospedado: as visualizações
// contam para o canal, que permite embed. Trechos escolhidos pelos capítulos do vídeo.
const VIDEO_ID = "O_31ak2enf4";
const CHANNEL = { name: "PlayZone Joga", url: "https://www.youtube.com/@PlayZoneJoga" };

export const SEGMENTS = [
  { label: "Leonida", start: 172, end: 210 },
  { label: "Vice City", start: 213, end: 310 },
  { label: "Leonida Keys", start: 516, end: 590 },
  { label: "Port Gellhorn", start: 643, end: 690 },
  { label: "Ambrosia", start: 721, end: 760 },
  { label: "Mount Kalaga", start: 771, end: 810 },
  { label: "Gloriana", start: 819, end: 840 },
  { label: "?", start: 840, end: 875 }, // cidade secreta — rótulo traduzido no componente
] as const;

const TOTAL_MIN = Math.round(SEGMENTS.reduce((s, x) => s + (x.end - x.start), 0) / 60);

type YTPlayer = {
  loadVideoById: (o: { videoId: string; startSeconds: number; endSeconds: number }) => void;
  destroy: () => void;
};
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    o: {
      host?: string;
      videoId: string;
      playerVars: Record<string, string | number>;
      events: { onReady?: () => void; onStateChange?: (e: { data: number }) => void };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number };
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYouTubeApi(): Promise<YTNamespace> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

export function MapVideo({ t }: { t: Dictionary["demo"] }) {
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const holder = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const idx = useRef(0);

  const label = (i: number) => (SEGMENTS[i].label === "?" ? t.secret : SEGMENTS[i].label);

  const play = (i: number) => {
    idx.current = i;
    setCurrent(i);
    const seg = SEGMENTS[i];
    player.current?.loadVideoById({ videoId: VIDEO_ID, startSeconds: seg.start, endSeconds: seg.end });
  };

  const start = async (i = 0) => {
    if (player.current) return play(i);
    idx.current = i;
    setCurrent(i);
    setStarted(true);
    const YT = await loadYouTubeApi();
    if (!holder.current) return;
    const seg = SEGMENTS[i];
    player.current = new YT.Player(holder.current, {
      host: "https://www.youtube-nocookie.com",
      videoId: VIDEO_ID,
      playerVars: { start: seg.start, end: seg.end, autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1, hl: "pt-BR" },
      events: {
        onStateChange: (e) => {
          // fim do trecho → próximo destaque
          if (e.data === YT.PlayerState.ENDED && idx.current < SEGMENTS.length - 1) play(idx.current + 1);
        },
      },
    });
  };

  useEffect(() => () => player.current?.destroy(), []);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink via-purple to-cyan p-px shadow-2xl shadow-purple/30">
        <div className="relative aspect-video overflow-hidden rounded-[23px] bg-ink">
          <div ref={holder} className="absolute inset-0 size-full [&>iframe]:size-full" />
          {!started && (
            <button type="button" onClick={() => start(0)} className="group absolute inset-0 grid place-items-center" aria-label={t.play}>
              {/* Capa própria (sem a miniatura do YouTube) */}
              <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(121_40_202/0.55),transparent_60%),linear-gradient(180deg,#120a24_0%,#3b1260_55%,#b02a7a_100%)]" />
              <span className="sun absolute bottom-[22%] left-1/2 size-[34%] -translate-x-1/2 rounded-full opacity-90" />
              <span className="absolute inset-x-0 bottom-0 h-[22%] overflow-hidden bg-ink">
                <span className="grid-floor absolute -inset-x-1/2 top-0 h-[200%]" />
              </span>
              <span className="absolute inset-x-0 bottom-[22%] h-px bg-pink" />
              <span className="relative flex flex-col items-center gap-4">
                <span className="grid size-20 place-items-center rounded-full bg-white/95 shadow-2xl shadow-pink/50 transition group-hover:scale-110 sm:size-24">
                  <svg viewBox="0 0 24 24" className="ml-1 size-9 fill-pink sm:size-10" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span className="rounded-full bg-black/50 px-4 py-1.5 font-display text-sm font-semibold text-white backdrop-blur sm:text-base">
                  {t.play} · {TOTAL_MIN} min
                </span>
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Regiões: pula direto para o trecho e segue a sequência */}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {SEGMENTS.map((s, i) => (
          <button
            key={s.start}
            type="button"
            onClick={() => start(i)}
            aria-pressed={started && current === i}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
              started && current === i ? "border-pink bg-pink/15 text-pink" : "border-line text-muted hover:border-cyan hover:text-cyan"
            }`}
          >
            {label(i)}
          </button>
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-muted/70">
        {t.highlights} · {t.credit}{" "}
        <a href={CHANNEL.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-pink">
          {CHANNEL.name}
        </a>{" "}
        ·{" "}
        <a href={`https://www.youtube.com/watch?v=${VIDEO_ID}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-pink">
          {t.source}
        </a>
      </p>
    </div>
  );
}
