"use client";

import { useState } from "react";
import type { Dictionary } from "../dictionaries";

// Vídeo do YouTube incorporado pelo player oficial (embed permitido pelo canal).
// Só carrega o YouTube após o clique: página mais leve e sem cookies de terceiros antes do consentimento.
const VIDEO_ID = "O_31ak2enf4";
const START_SECONDS = 550; // trecho sugerido: mapa e gameplay
const CHANNEL = { name: "PlayZone Joga", url: "https://www.youtube.com/@PlayZoneJoga" };

export function MapVideo({ t }: { t: Dictionary["demo"] }) {
  const [playing, setPlaying] = useState(false);
  const src = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?start=${START_SECONDS}&autoplay=1&rel=0&modestbranding=1&playsinline=1`;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="relative overflow-hidden rounded-3xl p-px shadow-2xl shadow-purple/30 bg-gradient-to-br from-pink via-purple to-cyan">
        <div className="relative aspect-video overflow-hidden rounded-[23px] bg-ink">
          {playing ? (
            <iframe
              src={src}
              title={t.title}
              className="absolute inset-0 size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="group absolute inset-0 grid place-items-center text-left"
              aria-label={t.play}
            >
              {/* Capa própria (sem a miniatura do YouTube) */}
              <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(121_40_202/0.55),transparent_60%),linear-gradient(180deg,#120a24_0%,#3b1260_55%,#b02a7a_100%)]" />
              <span className="sun absolute bottom-[18%] left-1/2 size-[38%] -translate-x-1/2 rounded-full opacity-90" />
              <span className="absolute inset-x-0 bottom-0 h-[22%] overflow-hidden">
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
                  {t.play}
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted/70">
        {t.credit}{" "}
        <a href={CHANNEL.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-pink">
          {CHANNEL.name}
        </a>{" "}
        ·{" "}
        <a href={`https://www.youtube.com/watch?v=${VIDEO_ID}&t=${START_SECONDS}s`} target="_blank" rel="noopener noreferrer" className="underline hover:text-pink">
          {t.source}
        </a>
      </p>
    </div>
  );
}
