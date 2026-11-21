// Gera as peças de marca do LeonidaPlay: logo, foto de perfil, posts do Instagram e imagem de compartilhamento.
// Uso: npm run render   → arquivos em marketing/out/ (PNG + SVG)
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
mkdirSync(out, { recursive: true });
const fontFiles = readdirSync(join(here, "fonts")).map((f) => join(here, "fonts", f));

const C = { ink: "#0B0C10", panel: "#13141B", fg: "#ECECF4", muted: "#A6A6C2", pink: "#FF2A85", purple: "#7928CA", cyan: "#00F0FF", sun: "#FFB36B" };

// ---------------------------------------------------------------------------
// Peças reutilizáveis
// ---------------------------------------------------------------------------

const defs = (id = "") => `
  <linearGradient id="sun${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.sun}"/><stop offset="0.55" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.purple}"/>
  </linearGradient>
  <linearGradient id="txt${id}" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${C.sun}"/><stop offset="0.5" stop-color="${C.pink}"/><stop offset="1" stop-color="#B14CFF"/>
  </linearGradient>
  <radialGradient id="glow${id}" cx="0.5" cy="0" r="0.9">
    <stop offset="0" stop-color="${C.purple}" stop-opacity="0.55"/><stop offset="1" stop-color="${C.purple}" stop-opacity="0"/>
  </radialGradient>
  <filter id="soft${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40"/></filter>`;

// Sol listrado: faixas horizontais vazadas na metade de baixo
function sun(cx, cy, r, id = "", clipY = null) {
  const stripes = [
    [0.08, 0.05],
    [0.24, 0.065],
    [0.42, 0.08],
    [0.62, 0.095],
    [0.84, 0.11],
  ]
    .map(([o, h]) => `<rect x="${cx - r}" y="${cy + o * r}" width="${2 * r}" height="${h * r}" fill="#000"/>`)
    .join("");
  const clip = clipY == null ? cy + r : clipY;
  return `
  <mask id="sunmask${id}"><rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${clip - (cy - r)}" fill="#fff"/>${stripes}</mask>
  <circle cx="${cx}" cy="${cy}" r="${r * 1.05}" fill="${C.pink}" opacity="0.35" filter="url(#soft${id})"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#sun${id})" mask="url(#sunmask${id})"/>`;
}

// Palmeira (mesma silhueta do site), escalada a partir da base
function palm(x, baseY, h, color = C.ink, flip = false) {
  const s = h / 220;
  const tx = flip ? `translate(${x + 60 * s} ${baseY - h}) scale(${-s} ${s}) translate(-60 0)` : `translate(${x - 60 * s} ${baseY - h}) scale(${s})`;
  return `<g transform="${tx}" fill="${color}">
    <path d="M58 220c2-50 4-95 2-138l6-1c3 44 1 89-2 139z"/>
    <path d="M62 84C48 62 22 56 2 66c20-2 40 4 54 22zM62 84c6-24 28-38 52-36-20 6-36 18-46 40zM62 84C40 72 16 80 6 98c14-10 34-14 52-10zM62 84c20-12 44-8 56 8-16-6-36-6-52 6zM62 84c-6-22-2-44 14-58-8 18-10 38-8 58z"/>
  </g>`;
}

// Chão em grade com perspectiva, do horizonte (y0) até a base (y1)
function grid(w, y0, y1) {
  let g = "";
  const cx = w / 2;
  for (let i = -14; i <= 14; i++) {
    const xb = cx + i * (w / 7);
    g += `<line x1="${cx + i * 18}" y1="${y0}" x2="${xb}" y2="${y1}"/>`;
  }
  for (let k = 1; k <= 9; k++) {
    const t = Math.pow(k / 9, 2.1);
    const y = y0 + t * (y1 - y0);
    g += `<line x1="0" y1="${y}" x2="${w}" y2="${y}"/>`;
  }
  return `<g stroke="${C.cyan}" stroke-opacity="0.45" stroke-width="2">${g}</g>
  <rect x="0" y="${y0}" width="${w}" height="${y1 - y0}" fill="url(#fade)"/>`;
}

// Marca: sol listrado + botão play ciano
function mark(x, y, size, { bg = true, id = "m", stroke = 3 } = {}) {
  const s = size / 64;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <defs>${defs(id)}
      <mask id="mm${id}"><rect width="64" height="64" fill="#fff"/><rect y="37" width="64" height="2.6" fill="#000"/><rect y="43" width="64" height="3.2" fill="#000"/><rect y="49.6" width="64" height="3.8" fill="#000"/></mask>
    </defs>
    ${bg ? `<rect width="64" height="64" rx="15" fill="${C.ink}"/>` : ""}
    <circle cx="32" cy="34" r="21" fill="url(#sun${id})" mask="url(#mm${id})"/>
    <path d="M26.5 21.5 L43 31.5 L26.5 41.5 Z" fill="${C.cyan}" stroke="${C.ink}" stroke-width="${stroke}" stroke-linejoin="round"/>
  </g>`;
}

const wordmark = (x, y, size, anchor = "start") =>
  `<text x="${x}" y="${y}" font-family="Unbounded" font-weight="800" font-size="${size}" text-anchor="${anchor}" letter-spacing="-0.5"><tspan fill="${C.fg}">Leonida</tspan><tspan fill="url(#txt)">Play</tspan></text>`;

const check = (x, y) => `<g transform="translate(${x} ${y})">
  <circle cx="22" cy="22" r="22" fill="${C.cyan}" fill-opacity="0.15"/>
  <path d="M12.5 22.5 L19 29 L32 15.5" fill="none" stroke="${C.cyan}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
</g>`;

const arrow = (x, y, color = "#fff") =>
  `<path d="M${x} ${y} h30 m-12 -12 l12 12 l-12 12" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>${defs()}
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.ink}" stop-opacity="0"/><stop offset="1" stop-color="${C.ink}" stop-opacity="0.9"/></linearGradient>
    <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.purple}"/></linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="${C.ink}"/>
  <rect width="${w}" height="${h * 0.7}" fill="url(#glow)"/>
  ${body}
</svg>`;
}

// Horizonte completo: sol + palmeiras + linha + grade
function horizon(w, hy, r, floorBottom) {
  return `${sun(w / 2, hy - r * 0.42, r, "", hy)}
  ${palm(w / 2 - r * 1.05, hy, r * 1.25)}
  ${palm(w / 2 + r * 0.98, hy, r * 0.95, C.ink, true)}
  ${palm(w * 0.09, hy, r * 0.95, "#2a1745")}
  ${palm(w * 0.92, hy, r * 0.75, "#24143c", true)}
  <rect x="0" y="${hy - 1.5}" width="${w}" height="3" fill="${C.pink}" opacity="0.9"/>
  ${grid(w, hy, floorBottom)}`;
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

const pieces = {};

// Logo (ícone do site / favicon)
pieces["logo"] = { w: 512, h: 512, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs>${defs()}</defs>${mark(0, 0, 512, { id: "logo" })}</svg>` };

// Foto de perfil (Instagram corta em círculo: marca centralizada)
pieces["instagram-perfil"] = {
  w: 1080,
  h: 1080,
  svg: svg(
    1080,
    1080,
    `<circle cx="540" cy="560" r="330" fill="${C.pink}" opacity="0.28" filter="url(#soft)"/>
     ${mark(190, 200, 700, { bg: false, id: "pf", stroke: 1.6 })}`,
  ),
};

// Post jogador (4:5)
pieces["instagram-post-jogador"] = {
  w: 1080,
  h: 1350,
  svg: svg(
    1080,
    1350,
    `${mark(72, 70, 72, { id: "pj" })}
     ${wordmark(162, 122, 38)}
     <rect x="742" y="78" width="266" height="56" rx="28" fill="${C.cyan}" fill-opacity="0.08" stroke="${C.cyan}" stroke-opacity="0.5" stroke-width="2"/>
     <circle cx="772" cy="106" r="6" fill="${C.cyan}"/>
     <text x="792" y="116" font-family="Manrope" font-weight="700" font-size="26" fill="${C.cyan}" letter-spacing="2">BETA · BRASIL</text>

     <text font-family="Unbounded" font-weight="800" font-size="104" letter-spacing="-2">
       <tspan x="72" y="330" fill="${C.fg}">Jogue GTA 6</tspan>
       <tspan x="72" y="450" fill="url(#txt)">sem ter</tspan>
       <tspan x="72" y="570" fill="url(#txt)">um PS5.</tspan>
     </text>
     <text font-family="Manrope" font-weight="500" font-size="40" fill="${C.muted}">
       <tspan x="72" y="660">Alugue tempo num PS5 de verdade e</tspan>
       <tspan x="72" y="714">jogue no navegador: PC, notebook ou</tspan>
       <tspan x="72" y="768">celular. Pague com Pix.</tspan>
     </text>
     <rect x="72" y="812" width="380" height="72" rx="36" fill="${C.panel}" stroke="${C.pink}" stroke-opacity="0.6" stroke-width="2"/>
     <text x="262" y="859" text-anchor="middle" font-family="Manrope" font-weight="700" font-size="32" fill="${C.fg}">A partir de <tspan fill="${C.pink}">R$ 7,50</tspan></text>

     ${horizon(1080, 1150, 180, 1350)}

     <rect x="72" y="1210" width="936" height="96" rx="28" fill="url(#cta)"/>
     <text x="110" y="1272" font-family="Unbounded" font-weight="600" font-size="34" fill="#fff">Entre na lista · link na bio</text>
     ${arrow(940, 1258)}`,
  ),
};

// Post anfitrião (4:5)
pieces["instagram-post-anfitriao"] = {
  w: 1080,
  h: 1350,
  svg: svg(
    1080,
    1350,
    `${mark(72, 70, 72, { id: "pa" })}
     ${wordmark(162, 122, 38)}
     <rect x="752" y="78" width="256" height="56" rx="28" fill="${C.pink}" fill-opacity="0.1" stroke="${C.pink}" stroke-opacity="0.55" stroke-width="2"/>
     <text x="880" y="116" text-anchor="middle" font-family="Manrope" font-weight="700" font-size="26" fill="${C.pink}" letter-spacing="2">ANFITRIÕES</text>

     <text font-family="Unbounded" font-weight="800" font-size="88" letter-spacing="-2">
       <tspan x="72" y="300" fill="${C.fg}">Seu PS5 parado</tspan>
       <tspan x="72" y="404" fill="${C.fg}">pode render</tspan>
       <tspan x="72" y="528" font-size="112" fill="url(#txt)">R$ 1.920</tspan>
     </text>
     <text x="72" y="584" font-family="Manrope" font-weight="700" font-size="36" fill="${C.muted}">por mês*</text>

     ${check(72, 640)}<text x="136" y="675" font-family="Manrope" font-weight="700" font-size="38" fill="${C.fg}">Você fica com 80% de cada hora</text>
     ${check(72, 716)}<text x="136" y="751" font-family="Manrope" font-weight="700" font-size="38" fill="${C.fg}">Pagamento via Pix toda sexta</text>
     ${check(72, 792)}<text x="136" y="827" font-family="Manrope" font-weight="700" font-size="38" fill="${C.fg}">Só precisa do PS5 e boa internet</text>
     ${check(72, 868)}<text x="136" y="903" font-family="Manrope" font-weight="700" font-size="38" fill="${C.fg}">Conta secundária: a sua fica protegida</text>

     ${horizon(1080, 1150, 155, 1350)}

     <rect x="72" y="1182" width="936" height="96" rx="28" fill="url(#cta)"/>
     <text x="110" y="1244" font-family="Unbounded" font-weight="600" font-size="34" fill="#fff">Seja anfitrião · link na bio</text>
     ${arrow(940, 1230)}
     <text x="540" y="1318" text-anchor="middle" font-family="Manrope" font-weight="500" font-size="22" fill="${C.muted}">*Estimativa com 4 h alugadas por dia (pacote de 1 h, R$ 16 para você). Não é garantia.</text>`,
  ),
};

// Imagem de compartilhamento do site (WhatsApp, redes)
pieces["og"] = {
  w: 1200,
  h: 630,
  svg: svg(
    1200,
    630,
    `${mark(64, 56, 64, { id: "og" })}
     ${wordmark(144, 102, 34)}
     <text font-family="Unbounded" font-weight="800" font-size="76" letter-spacing="-1.5">
       <tspan x="64" y="250" fill="${C.fg}">Jogue GTA 6</tspan>
       <tspan x="64" y="340" fill="url(#txt)">sem ter um PS5.</tspan>
     </text>
     <text x="64" y="410" font-family="Manrope" font-weight="500" font-size="32" fill="${C.muted}">PS5 de verdade, no navegador. Pague com Pix.</text>
     <text x="64" y="456" font-family="Manrope" font-weight="700" font-size="30" fill="${C.cyan}">Tem um PS5? Ganhe dinheiro alugando.</text>
     ${sun(1010, 500, 160, "", 560)}
     <rect x="0" y="560" width="1200" height="3" fill="${C.pink}"/>
     ${grid(1200, 562, 630)}`,
  ),
};

// ---------------------------------------------------------------------------

for (const [name, p] of Object.entries(pieces)) {
  writeFileSync(join(out, `${name}.svg`), p.svg);
  const png = new Resvg(p.svg, {
    fitTo: { mode: "width", value: p.w },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Manrope" },
  }).render().asPng();
  writeFileSync(join(out, `${name}.png`), png);
  console.log(`✓ ${name}.png  ${p.w}×${p.h}`);
}
