import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { formatBRL } from "@leonidaplay/ledger";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { TZ } from "@/lib/admin-data";
import { countSince, getUsers } from "@/lib/admin-finance";
import { adminToggleBlock } from "../actions";
import { AdminNav, Card, Kpi, td, th } from "../_ui";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function UsersPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-muted">Carregando usuários…</p>}>
        <Users />
      </Suspense>
    </main>
  );
}

async function Users() {
  await connection();
  if (!isAdminAuthorized((await headers()).get("authorization"))) notFound();
  const users = await getUsers();
  const payers = users.filter((u) => u.paidMinor > 0).length;

  return (
    <div className="grid gap-6">
      <AdminNav active="/admin/usuarios" />
      <header>
        <h1 className="font-display text-2xl font-bold text-fg sm:text-3xl">Usuários</h1>
        <p className="mt-1 text-sm text-muted">Contas criadas pelo login com código no e-mail (/pt/entrar)</p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Contas" value={users.length} />
        <Kpi label="Novas (7 dias)" value={countSince(users, 7)} />
        <Kpi label="Já pagaram Pix" value={payers} hint={users.length ? `${Math.round((payers / users.length) * 100)}% das contas` : undefined} />
        <Kpi label="Saldo em carteiras" value={formatBRL(users.reduce((s, u) => s + u.balanceMinor, 0))} />
      </section>

      <Card title={`Contas (${users.length})`} subtitle="Mais recentes primeiro">
        {users.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Ninguém criou conta ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Criada em", "E-mail", "País", "Saldo", "Total recarregado", "Recargas", "Situação", ""].map((h) => (
                    <th key={h} className={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-line/60">
                    <td className={`${td} tabular-nums text-muted`}>{dateFmt.format(u.createdAt)}</td>
                    <td className={`${td} text-fg`}>{u.email}</td>
                    <td className={`${td} text-muted`}>{u.countryCode ?? "—"}</td>
                    <td className={`${td} font-semibold tabular-nums text-fg`}>{formatBRL(u.balanceMinor)}</td>
                    <td className={`${td} tabular-nums text-fg`}>{formatBRL(u.paidMinor)}</td>
                    <td className={`${td} tabular-nums text-muted`}>{u._count.topUps}</td>
                    <td className={`${td} text-xs font-semibold ${u.blockedAt ? "text-pink" : "text-cyan"}`}>{u.blockedAt ? "Bloqueado" : "Ativo"}</td>
                    <td className={td}>
                      <form action={adminToggleBlock}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:border-pink hover:text-fg">
                          {u.blockedAt ? "Desbloquear" : "Bloquear"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
