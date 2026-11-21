import { cacheLife } from "next/cache";

import { isUF, type UF } from "./ufs";

export { UFS, isUF, type UF } from "./ufs";

/** Chave para comparar nomes: sem acento, minúsculo, espaços simples. "SÃO  paulo " → "sao paulo" */
export const foldName = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9' -]/g, "").replace(/\s+/g, " ").trim();

const LOWER = new Set(["de", "da", "do", "das", "dos", "e", "d'"]);
/** Fallback quando a cidade não está na lista do IBGE: "sao jose dos campos" → "Sao Jose dos Campos" */
export function titleCasePt(s: string) {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && LOWER.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Municípios oficiais da UF (API pública do IBGE), em cache por semanas. Lança em erro para não cachear lista vazia. */
export async function getMunicipios(uf: UF): Promise<string[]> {
  "use cache";
  cacheLife("weeks");
  const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
  if (!res.ok) throw new Error(`IBGE ${res.status}`);
  const list = (await res.json()) as { nome: string }[];
  return list.map((m) => m.nome);
}

/** Nome oficial da cidade quando bate com o IBGE (ignorando acento/maiúsculas); senão, só arruma maiúsculas. */
export async function canonicalCity(city: string | undefined, uf: string | undefined) {
  if (!city) return undefined;
  if (isUF(uf)) {
    try {
      const key = foldName(city);
      const hit = (await getMunicipios(uf)).find((n) => foldName(n) === key);
      if (hit) return hit;
    } catch (err) {
      console.warn("ibge: lista indisponível", err);
    }
  }
  return titleCasePt(city);
}

/** Localização aproximada do visitante pelos headers que a Vercel injeta (cidade, UF, país). */
export function geoFromHeaders(h: Headers) {
  const raw = h.get("x-vercel-ip-city");
  let city: string | undefined;
  try {
    city = raw ? decodeURIComponent(raw) : undefined;
  } catch {
    city = raw ?? undefined;
  }
  const country = h.get("x-vercel-ip-country") ?? undefined;
  const region = h.get("x-vercel-ip-country-region") ?? undefined;
  return { city, country, uf: country === "BR" && isUF(region) ? region : undefined, region };
}
