import { headers } from "next/headers";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { cityOf, getWaitlist, TZ, ufOf } from "@/lib/admin-data";

const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });

// Evita fórmula no Excel (=, +, -, @) e escapa aspas; separador ";" abre direto no Excel em pt-BR.
function cell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  if (!isAdminAuthorized((await headers()).get("authorization"))) return new Response("Acesso restrito", { status: 401 });

  const kind = new URL(request.url).searchParams.get("tipo") === "anfitriao" ? "HOST" : "PLAYER";
  const rows = (await getWaitlist()).filter((r) => r.kind === kind);

  const cols =
    kind === "HOST"
      ? ["Data", "Nome", "E-mail", "WhatsApp", "Cidade", "UF", "Cidade (IP)", "Modelo", "Tem GTA 6", "Upload", "Horas/dia", "Beta", "Origem"]
      : ["Data", "Nome", "E-mail", "Cidade", "UF", "Cidade (IP)", "Dispositivo", "Idioma", "Origem"];
  const lines = rows.map((r) =>
    (kind === "HOST"
      ? [fmt.format(r.createdAt), r.name, r.email, r.whatsapp, cityOf(r), ufOf(r), r.ipCity, r.consoleModel, r.hasGame == null ? "" : r.hasGame ? "sim" : "não", r.uploadMbps, r.hoursPerDay, r.betaTester ? "sim" : "não", r.utmSource]
      : [fmt.format(r.createdAt), r.name, r.email, cityOf(r), ufOf(r), r.ipCity, r.device, r.locale, r.utmSource]
    )
      .map(cell)
      .join(";"),
  );
  const csv = "﻿" + [cols.join(";"), ...lines].join("\r\n");
  const name = `leonidaplay-${kind === "HOST" ? "anfitrioes" : "jogadores"}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
