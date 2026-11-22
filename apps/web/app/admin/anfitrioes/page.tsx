import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { prisma } from "@leonidaplay/db";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { TZ } from "@/lib/admin-data";
import { maskCPF } from "@/lib/br";
import { decrypt } from "@/lib/crypto";
import { CHECKLIST } from "@/lib/host-checklist";
import { adminSetHostStatus } from "../actions";
import { AdminNav, Card, Kpi, td, th } from "../_ui";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_ONBOARDING: { label: "Em análise", cls: "text-sun" },
  ACTIVE: { label: "Aprovado", cls: "text-cyan" },
  SUSPENDED: { label: "Suspenso", cls: "text-pink" },
  BANNED: { label: "Encerrado", cls: "text-pink" },
};
const MODEL: Record<string, string> = { PS5: "PS5", PS5_DIGITAL: "PS5 Digital", PS5_PRO: "PS5 Pro" };
const PIX: Record<string, string> = { CPF: "CPF", EMAIL: "E-mail", PHONE: "Celular", RANDOM: "Aleatória" };

export default function HostsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-muted">Carregando anfitriões…</p>}>
        <Hosts />
      </Suspense>
    </main>
  );
}

function safeMaskCPF(enc: Uint8Array | null) {
  if (!enc) return "—";
  try {
    return maskCPF(decrypt(enc));
  } catch {
    return "não foi possível decifrar";
  }
}

async function Hosts() {
  await connection();
  if (!isAdminAuthorized((await headers()).get("authorization"))) notFound();

  const hosts = await prisma.hostProfile.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      status: true,
      legalName: true,
      documentEncrypted: true,
      pixKeyType: true,
      pixKeyLast4: true,
      createdAt: true,
      user: { select: { email: true } },
      consoles: {
        take: 1,
        orderBy: { createdAt: "asc" },
        select: {
          nickname: true,
          model: true,
          secondaryOnlineId: true,
          measuredUploadMbps: true,
          listed: true,
          lastSeenAt: true,
          checklistVerifiedAt: true,
          checkSpendingLimitZero: true,
          checkCommsRestricted: true,
          checkConsoleSharingOn: true,
          checkRestModeNetworkOn: true,
          checkRemotePlayOn: true,
          checkPsPlusActive: true,
        },
      },
    },
  });

  const pending = hosts.filter((h) => h.status === "PENDING_ONBOARDING");
  const ready = pending.filter((h) => h.legalName && h.consoles[0]?.checklistVerifiedAt).length;

  return (
    <div className="grid gap-6">
      <AdminNav active="/admin/anfitrioes" />
      <header>
        <h1 className="font-display text-2xl font-bold text-fg sm:text-3xl">Anfitriões</h1>
        <p className="mt-1 text-sm text-muted">Cadastros feitos em /pt/anfitriao. O console só aparece na vitrine depois de aprovado.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Cadastros" value={hosts.length} />
        <Kpi label="Prontos para aprovar" value={ready} hint="dados + console + checklist completos" />
        <Kpi label="Aprovados" value={hosts.filter((h) => h.status === "ACTIVE").length} />
        <Kpi label="Anunciados agora" value={hosts.filter((h) => h.consoles[0]?.listed).length} />
      </section>

      <Card title={`Anfitriões (${hosts.length})`} subtitle="Confira os dados antes de aprovar. CPF exibido mascarado.">
        {hosts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nenhum anfitrião cadastrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Desde", "Anfitrião", "Repasse", "Console", "Checklist", "Upload", "Situação", ""].map((h) => (
                    <th key={h} className={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hosts.map((h) => {
                  const c = h.consoles[0];
                  const checks = c ? CHECKLIST.filter((i) => c[i.field]).length : 0;
                  const complete = Boolean(h.legalName && c?.checklistVerifiedAt);
                  return (
                    <tr key={h.id} className="border-t border-line/60">
                      <td className={`${td} tabular-nums text-muted`}>{dateFmt.format(h.createdAt)}</td>
                      <td className={td}>
                        <p className="text-fg">{h.legalName ?? "—"}</p>
                        <p className="text-xs text-muted">{h.user.email}</p>
                      </td>
                      <td className={td}>
                        <p className="text-fg">{safeMaskCPF(h.documentEncrypted)}</p>
                        <p className="text-xs text-muted">{h.pixKeyType ? `Pix ${PIX[h.pixKeyType]} final ${h.pixKeyLast4}` : "sem Pix"}</p>
                      </td>
                      <td className={td}>
                        {c ? (
                          <>
                            <p className="text-fg">{c.nickname}</p>
                            <p className="text-xs text-muted">
                              {MODEL[c.model]} · conta {c.secondaryOnlineId ?? "—"}
                              {c.listed ? " · anunciado" : ""}
                            </p>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className={`${td} tabular-nums ${checks === CHECKLIST.length ? "text-cyan" : "text-sun"}`}>
                        {checks}/{CHECKLIST.length}
                      </td>
                      <td className={`${td} tabular-nums text-fg`}>{c?.measuredUploadMbps != null ? `${c.measuredUploadMbps} Mbps` : "—"}</td>
                      <td className={`${td} text-xs font-semibold ${STATUS[h.status].cls}`}>
                        {STATUS[h.status].label}
                        {h.status === "PENDING_ONBOARDING" && !complete && <span className="block font-normal text-muted">cadastro incompleto</span>}
                      </td>
                      <td className={td}>
                        <form action={adminSetHostStatus} className="flex gap-2">
                          <input type="hidden" name="id" value={h.id} />
                          {h.status !== "ACTIVE" && (
                            <button
                              name="status"
                              value="ACTIVE"
                              disabled={!complete}
                              title={complete ? undefined : "Cadastro incompleto"}
                              className="rounded-lg border border-cyan/50 px-2.5 py-1 text-xs font-semibold text-cyan hover:bg-cyan/10 disabled:opacity-40"
                            >
                              {h.status === "SUSPENDED" ? "Reativar" : "Aprovar"}
                            </button>
                          )}
                          {h.status === "ACTIVE" && (
                            <button name="status" value="SUSPENDED" className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:border-pink hover:text-fg">
                              Suspender
                            </button>
                          )}
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
