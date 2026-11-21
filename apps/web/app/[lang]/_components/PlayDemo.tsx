"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dictionary } from "../dictionaries";

// Demo ilustrativa: estrada ao pôr do sol (arte original, estilo synthwave) com a interface
// de streaming do LeonidaPlay por cima. Mostra o produto — não é imagem do jogo.

type T = Dictionary["demo"];

const PALM_PATH =
  "M58 220c2-50 4-95 2-138l6-1c3 44 1 89-2 139zM62 84C48 62 22 56 2 66c20-2 40 4 54 22zM62 84c6-24 28-38 52-36-20 6-36 18-46 40zM62 84C40 72 16 80 6 98c14-10 34-14 52-10zM62 84c20-12 44-8 56 8-16-6-36-6-52 6zM62 84c-6-22-2-44 14-58-8 18-10 38-8 58z";

type Building = { x: number; w: number; h: number; lit: number[] };

function makeSkyline(seed: number): Building[] {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const out: Building[] = [];
  let x = 0;
  while (x < 1) {
    const w = 0.02 + rnd() * 0.045;
    const h = Math.abs(x - 0.5) < 0.16 ? 0.012 + rnd() * 0.02 : 0.04 + rnd() * 0.16;
    out.push({ x, w, h, lit: Array.from({ length: 6 }, () => rnd()) });
    x += w + rnd() * 0.006;
  }
  return out;
}

export function PlayDemo({ t }: { t: T }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const steerRef = useRef(0); // -1..1 alvo
  const keys = useRef({ left: false, right: false });
  const [device, setDevice] = useState<"pc" | "phone">("pc");
  const [seconds, setSeconds] = useState(15 * 60);
  const [ping, setPing] = useState(18);
  const [active, setActive] = useState(false);

  // Relógio da sessão: corre acelerado (x12) para mostrar o aviso de fim de tempo; depois recomeça.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setSeconds((s) => (s <= 0 ? 15 * 60 : s - 12));
      setPing(16 + Math.round(Math.random() * 6));
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  // Teclado (só quando a demo está visível/ativa)
  useEffect(() => {
    if (!active) return;
    const set = (e: KeyboardEvent, v: boolean) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") keys.current.left = v;
      else if (k === "arrowright" || k === "d") keys.current.right = v;
      else return;
      if (document.activeElement === wrapRef.current) e.preventDefault();
    };
    const down = (e: KeyboardEvent) => set(e, true);
    const up = (e: KeyboardEvent) => set(e, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [active]);

  // Animação
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const PALM = new Path2D(PALM_PATH); // só existe no navegador
    const skyline = makeSkyline(7);
    const palms = Array.from({ length: 10 }, (_, i) => ({ z: i / 10, side: i % 2 ? 1 : -1 }));
    let raf = 0;
    let visible = true;
    let carX = 0;
    let dash = 0;
    let last = performance.now();

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      setActive(e.isIntersecting);
      if (visible) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(canvas);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas!.getBoundingClientRect();
      canvas!.width = Math.round(r.width * dpr);
      canvas!.height = Math.round(r.height * dpr);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function frame(now: number) {
      if (!visible) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const W = canvas!.width;
      const H = canvas!.height;
      const hy = H * 0.52; // horizonte
      const cx = W / 2;

      // direção: teclado > toque/arraste
      const k = keys.current;
      const target = k.left !== k.right ? (k.left ? -1 : 1) : steerRef.current;
      carX += (target * 0.55 - carX) * Math.min(1, dt * 5);
      const speed = reduce ? 0 : 1;
      dash = (dash + dt * 1.4 * speed) % 1;

      // céu
      const sky = ctx!.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, "#120a24");
      sky.addColorStop(0.55, "#3b1260");
      sky.addColorStop(1, "#b02a7a");
      ctx!.fillStyle = sky;
      ctx!.fillRect(0, 0, W, hy);

      // estrelas
      ctx!.fillStyle = "rgba(255,255,255,0.6)";
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 97.3) % 100) / 100;
        const sy = ((i * 53.7) % 100) / 100;
        ctx!.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(now / 900 + i));
        ctx!.fillRect(sx * W, sy * hy * 0.6, 1.5, 1.5);
      }
      ctx!.globalAlpha = 1;

      // sol listrado
      const r = H * 0.24;
      const sy = hy - r * 0.62;
      const sun = ctx!.createLinearGradient(0, sy - r, 0, sy + r);
      sun.addColorStop(0, "#ffd27a");
      sun.addColorStop(0.5, "#ff2a85");
      sun.addColorStop(1, "#7928ca");
      ctx!.save();
      ctx!.beginPath();
      ctx!.rect(0, 0, W, hy);
      ctx!.clip();
      ctx!.shadowColor = "rgba(255,42,133,0.8)";
      ctx!.shadowBlur = r * 0.5;
      ctx!.fillStyle = sun;
      ctx!.beginPath();
      ctx!.arc(cx, sy, r, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.shadowBlur = 0;
      ctx!.fillStyle = "#3b1260";
      [0.12, 0.3, 0.46, 0.6].forEach((o, i) => {
        const yy = sy + o * r;
        const off = ((now / 60) % 6) * (reduce ? 0 : 1);
        ctx!.fillRect(cx - r, yy + off, 2 * r, r * (0.05 + i * 0.025));
      });
      ctx!.restore();

      // skyline
      const sk = skyline;
      for (const b of sk) {
        const bx = b.x * W;
        const bw = b.w * W;
        const bh = b.h * H;
        ctx!.fillStyle = "#1a0b33";
        ctx!.fillRect(bx, hy - bh, bw, bh);
        b.lit.forEach((l, i) => {
          if (l > 0.55) {
            ctx!.fillStyle = l > 0.85 ? "rgba(0,240,255,0.8)" : "rgba(255,179,107,0.7)";
            ctx!.fillRect(bx + bw * 0.25 + (i % 2) * bw * 0.3, hy - bh + bh * 0.15 + Math.floor(i / 2) * bh * 0.22, Math.max(1.5, bw * 0.12), Math.max(1.5, bh * 0.06));
          }
        });
      }

      // chão
      const ground = ctx!.createLinearGradient(0, hy, 0, H);
      ground.addColorStop(0, "#1b0830");
      ground.addColorStop(1, "#05040a");
      ctx!.fillStyle = ground;
      ctx!.fillRect(0, hy, W, H - hy);

      // grade lateral
      ctx!.strokeStyle = "rgba(0,240,255,0.25)";
      ctx!.lineWidth = Math.max(1, W / 900);
      for (let i = 0; i < 7; i++) {
        const z = (i + dash) / 7;
        const y = hy + Math.pow(z, 2.2) * (H - hy);
        ctx!.beginPath();
        ctx!.moveTo(0, y);
        ctx!.lineTo(W, y);
        ctx!.stroke();
      }

      // estrada (trapézio)
      const roadTop = W * 0.02;
      const roadBottom = W * 0.62;
      ctx!.fillStyle = "#0d0a16";
      ctx!.beginPath();
      ctx!.moveTo(cx - roadTop, hy);
      ctx!.lineTo(cx + roadTop, hy);
      ctx!.lineTo(cx + roadBottom, H);
      ctx!.lineTo(cx - roadBottom, H);
      ctx!.closePath();
      ctx!.fill();
      // bordas neon
      ctx!.lineWidth = Math.max(2, W / 400);
      ctx!.shadowBlur = 12;
      ctx!.strokeStyle = "#ff2a85";
      ctx!.shadowColor = "#ff2a85";
      ctx!.beginPath();
      ctx!.moveTo(cx - roadTop, hy);
      ctx!.lineTo(cx - roadBottom, H);
      ctx!.stroke();
      ctx!.strokeStyle = "#00f0ff";
      ctx!.shadowColor = "#00f0ff";
      ctx!.beginPath();
      ctx!.moveTo(cx + roadTop, hy);
      ctx!.lineTo(cx + roadBottom, H);
      ctx!.stroke();
      ctx!.shadowBlur = 0;

      // faixas centrais
      ctx!.fillStyle = "rgba(255,210,122,0.9)";
      for (let i = 0; i < 9; i++) {
        const z0 = (i + dash) / 9;
        const z1 = z0 + 0.045;
        const y0 = hy + Math.pow(z0, 2.2) * (H - hy);
        const y1 = hy + Math.pow(Math.min(1, z1), 2.2) * (H - hy);
        const w0 = W * 0.002 + z0 * W * 0.008;
        const w1 = W * 0.002 + z1 * W * 0.008;
        ctx!.beginPath();
        ctx!.moveTo(cx - w0, y0);
        ctx!.lineTo(cx + w0, y0);
        ctx!.lineTo(cx + w1, y1);
        ctx!.lineTo(cx - w1, y1);
        ctx!.fill();
      }

      // palmeiras passando
      for (const p of palms) {
        p.z += dt * 0.32 * speed;
        if (p.z > 1) p.z -= 1;
        const z = p.z;
        const y = hy + Math.pow(z, 2.2) * (H - hy);
        const x = cx + p.side * (roadTop + Math.pow(z, 2.2) * (roadBottom - roadTop) + W * 0.04 + z * W * 0.12);
        const h = H * (0.05 + Math.pow(z, 2.2) * 0.9);
        const s = h / 220;
        ctx!.save();
        ctx!.translate(x, y);
        ctx!.scale(p.side * s, s);
        ctx!.translate(-60, -220);
        ctx!.fillStyle = z < 0.4 ? "#2a1248" : "#07050d";
        ctx!.fill(PALM);
        ctx!.restore();
      }

      // carro (vista traseira)
      const carW = W * 0.2;
      const carH = carW * 0.42;
      const carY = H - carH - H * 0.05;
      const carCx = cx + carX * (roadBottom - carW * 0.6);
      const tilt = (target * 0.55 - carX) * 0.25;
      ctx!.save();
      ctx!.translate(carCx, carY + carH / 2);
      ctx!.rotate(tilt);
      ctx!.translate(-carW / 2, -carH / 2);
      // sombra
      ctx!.fillStyle = "rgba(0,0,0,0.55)";
      ctx!.beginPath();
      ctx!.ellipse(carW / 2, carH * 1.02, carW * 0.55, carH * 0.14, 0, 0, Math.PI * 2);
      ctx!.fill();
      // teto e vidro
      ctx!.fillStyle = "#1c1430";
      ctx!.beginPath();
      ctx!.moveTo(carW * 0.22, carH * 0.38);
      ctx!.lineTo(carW * 0.32, 0);
      ctx!.lineTo(carW * 0.68, 0);
      ctx!.lineTo(carW * 0.78, carH * 0.38);
      ctx!.closePath();
      ctx!.fill();
      ctx!.fillStyle = "rgba(0,240,255,0.25)";
      ctx!.beginPath();
      ctx!.moveTo(carW * 0.27, carH * 0.34);
      ctx!.lineTo(carW * 0.35, carH * 0.06);
      ctx!.lineTo(carW * 0.65, carH * 0.06);
      ctx!.lineTo(carW * 0.73, carH * 0.34);
      ctx!.closePath();
      ctx!.fill();
      // carroceria
      const body = ctx!.createLinearGradient(0, carH * 0.35, 0, carH);
      body.addColorStop(0, "#ff2a85");
      body.addColorStop(1, "#5a1270");
      ctx!.fillStyle = body;
      ctx!.beginPath();
      ctx!.roundRect(0, carH * 0.36, carW, carH * 0.5, carH * 0.12);
      ctx!.fill();
      // lanternas
      ctx!.shadowColor = "#ff1744";
      ctx!.shadowBlur = carH * 0.5;
      ctx!.fillStyle = "#ff3b5c";
      ctx!.fillRect(carW * 0.04, carH * 0.48, carW * 0.26, carH * 0.08);
      ctx!.fillRect(carW * 0.7, carH * 0.48, carW * 0.26, carH * 0.08);
      ctx!.shadowBlur = 0;
      // placa
      ctx!.fillStyle = "#ececf4";
      ctx!.fillRect(carW * 0.41, carH * 0.62, carW * 0.18, carH * 0.12);
      ctx!.fillStyle = "#0b0c10";
      ctx!.font = `700 ${Math.round(carH * 0.09)}px sans-serif`;
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      ctx!.fillText("LP-2026", carW * 0.5, carH * 0.685);
      // pneus
      ctx!.fillStyle = "#050409";
      ctx!.fillRect(carW * 0.06, carH * 0.84, carW * 0.16, carH * 0.16);
      ctx!.fillRect(carW * 0.78, carH * 0.84, carW * 0.16, carH * 0.16);
      ctx!.restore();

      // vinheta
      const vg = ctx!.createRadialGradient(cx, H * 0.55, H * 0.3, cx, H * 0.55, W * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx!.fillStyle = vg;
      ctx!.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  // Arrastar / tocar na tela também dirige
  const onPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.buttons !== 1) return;
    const r = e.currentTarget.getBoundingClientRect();
    steerRef.current = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
  }, []);
  const release = useCallback(() => {
    steerRef.current = 0;
  }, []);
  const setSteer = useCallback((v: number) => {
    steerRef.current = v;
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const warn = seconds <= 60;
  const phone = device === "phone";

  return (
    <div>
      <div role="tablist" className="mx-auto mb-6 grid w-fit grid-cols-2 gap-1 rounded-2xl border border-line bg-ink/60 p-1">
        {(["pc", "phone"] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={device === d}
            onClick={() => setDevice(d)}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${device === d ? "bg-gradient-to-r from-pink to-purple text-white" : "text-muted hover:text-fg"}`}
          >
            {d === "pc" ? t.pc : t.phone}
          </button>
        ))}
      </div>

      {/* Moldura: notebook ou celular deitado */}
      <div className={`mx-auto transition-all duration-500 ${phone ? "max-w-[620px]" : "max-w-4xl"}`}>
        <div className={`relative bg-[#1d1e27] shadow-2xl shadow-purple/30 ring-1 ring-white/10 ${phone ? "rounded-[2.2rem] p-3 sm:p-4" : "rounded-t-2xl p-2 sm:p-3"}`}>
          <div
            ref={wrapRef}
            tabIndex={0}
            aria-label={t.hintPc}
            onPointerDown={onPointer}
            onPointerMove={onPointer}
            onPointerUp={release}
            onPointerLeave={release}
            className={`relative aspect-video touch-none select-none overflow-hidden bg-black outline-none focus-visible:ring-2 focus-visible:ring-cyan ${phone ? "rounded-[1.4rem]" : "rounded-lg"}`}
          >
            <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />

            {/* HUD do LeonidaPlay */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent p-2.5 text-[10px] font-semibold sm:p-4 sm:text-xs">
              <div className="flex items-center gap-2 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur">
                <span className="size-1.5 animate-pulse rounded-full bg-pink sm:size-2" />
                <span className="text-pink">{t.live}</span>
                <span className="hidden text-fg/80 sm:inline">· {t.console}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className={`rounded-full px-2.5 py-1 tabular-nums backdrop-blur ${warn ? "bg-pink text-white" : "bg-black/50 text-fg"}`}>
                  {t.time} {mm}:{ss}
                </span>
                <span className="rounded-full bg-black/50 px-2.5 py-1 tabular-nums text-cyan backdrop-blur">
                  {t.ping} {ping} ms
                </span>
                <span className="hidden rounded-full bg-black/50 px-2.5 py-1 text-fg backdrop-blur sm:inline">60 FPS</span>
              </div>
            </div>

            {warn && (
              <div className="pointer-events-none absolute left-1/2 top-12 -translate-x-1/2 rounded-full bg-pink/90 px-4 py-1.5 text-xs font-bold text-white shadow-lg sm:top-16 sm:text-sm">
                {t.warning}
              </div>
            )}

            {/* Controles na tela (celular) */}
            {phone && (
              <>
                <div className="absolute bottom-3 left-3 flex gap-2 sm:bottom-5 sm:left-5">
                  <SteerButton dir={-1} onSteer={setSteer} />
                  <SteerButton dir={1} onSteer={setSteer} />
                </div>
                <div className="pointer-events-none absolute bottom-3 right-3 grid grid-cols-2 gap-1.5 sm:bottom-5 sm:right-5">
                  {["△", "○", "□", "✕"].map((b, i) => (
                    <span key={b} className={`grid size-8 place-items-center rounded-full border border-white/30 bg-white/10 text-xs backdrop-blur sm:size-10 ${["text-cyan", "text-pink", "text-[#ff8bd0]", "text-[#7fb2ff]"][i]}`}>
                      {b}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        {!phone && <div className="mx-auto h-3 w-[104%] -translate-x-[2%] rounded-b-2xl bg-gradient-to-b from-[#2a2b36] to-[#15161d] shadow-xl" />}
      </div>

      <p className="mt-5 text-center text-sm text-muted">{phone ? t.hintPhone : t.hintPc}</p>
      <p className="mt-1 text-center text-xs text-muted/60">{t.illustrative}</p>
    </div>
  );
}

function SteerButton({ dir, onSteer }: { dir: -1 | 1; onSteer: (v: number) => void }) {
  const stop = () => onSteer(0);
  return (
    <button
      type="button"
      aria-label={dir < 0 ? "←" : "→"}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSteer(dir);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className="grid size-11 place-items-center rounded-full border border-white/30 bg-white/10 text-lg text-white backdrop-blur active:bg-white/30 sm:size-14"
    >
      {dir < 0 ? "◀" : "▶"}
    </button>
  );
}
