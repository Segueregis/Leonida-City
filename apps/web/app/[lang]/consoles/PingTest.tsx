"use client";

import { useState } from "react";

type Result = { median: number; jitter: number };

function verdict(ms: number) {
  if (ms <= 40) return { label: "Excelente para jogar", cls: "text-cyan", bar: "bg-cyan", pct: 100 };
  if (ms <= 70) return { label: "Boa para jogar", cls: "text-cyan", bar: "bg-cyan", pct: 75 };
  if (ms <= 110) return { label: "Jogável, pode ter atraso", cls: "text-sun", bar: "bg-sun", pct: 45 };
  return { label: "Alta demais para jogar bem", cls: "text-pink", bar: "bg-pink", pct: 20 };
}

/** Mede a latência navegador → servidor em São Paulo (mesma região do relay). 1ª medida é descartada (abre a conexão). */
export function PingTest() {
  const [state, setState] = useState<"idle" | "running" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setState("running");
    setResult(null);
    try {
      const samples: number[] = [];
      for (let i = 0; i < 11; i++) {
        const t0 = performance.now();
        const res = await fetch(`/api/ping?t=${Date.now()}-${i}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const dt = performance.now() - t0;
        if (i > 0) samples.push(dt);
      }
      samples.sort((a, b) => a - b);
      const median = samples[Math.floor(samples.length / 2)];
      const jitter = samples[samples.length - 2] - samples[1];
      setResult({ median: Math.round(median), jitter: Math.round(jitter) });
      setState("idle");
    } catch {
      setState("error");
    }
  }

  const v = result ? verdict(result.median) : null;

  return (
    <div className="rounded-3xl border border-line bg-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-fg">Teste sua conexão</h2>
          <p className="mt-1 text-sm text-muted">Mede o tempo de resposta da sua internet até nosso servidor em São Paulo.</p>
        </div>
        <button
          onClick={run}
          disabled={state === "running"}
          className="rounded-xl border border-cyan/50 px-5 py-2.5 font-semibold text-cyan hover:bg-cyan/10 disabled:opacity-60"
        >
          {state === "running" ? "Testando…" : result ? "Testar de novo" : "Testar agora"}
        </button>
      </div>

      {v && result && (
        <div className="mt-5" aria-live="polite">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-3xl font-bold tabular-nums text-fg">{result.median} ms</span>
            <span className={`text-sm font-semibold ${v.cls}`}>{v.label}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-line/60">
            <div className={`h-full rounded-full ${v.bar}`} style={{ width: `${v.pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            Variação: {result.jitter} ms. Use cabo ou fique perto do roteador Wi-Fi para melhorar. Antes de cada sessão também testamos o
            caminho completo até o PS5 escolhido.
          </p>
        </div>
      )}
      {state === "error" && <p className="mt-4 text-sm text-sun">Não foi possível testar agora. Confira sua internet e tente de novo.</p>}
    </div>
  );
}
