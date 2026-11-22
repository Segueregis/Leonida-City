"use client";

import { useActionState, useState } from "react";
import { CHECKLIST } from "@/lib/host-checklist";
import { saveChecklistAction, saveConsoleAction, savePayoutAction, toggleListedAction, type FormState } from "./actions";

const input = "w-full rounded-xl border bg-ink px-4 py-3 text-fg placeholder:text-muted/60 focus:border-cyan focus:outline-none";
const border = (bad: boolean) => (bad ? "border-pink" : "border-line");
const primary = "rounded-xl bg-gradient-to-r from-pink to-purple px-5 py-3 font-semibold text-white shadow-lg shadow-pink/25 hover:brightness-110 disabled:opacity-60";

function Feedback({ state, okText }: { state: FormState; okText: string }) {
  if (state.error) return <p role="alert" className="text-sm font-medium text-sun">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-sm font-medium text-cyan">{okText}</p>;
  return null;
}

// ---------- 1 ----------

const PIX_TYPES = [
  { v: "CPF", label: "CPF", ph: "000.000.000-00" },
  { v: "EMAIL", label: "E-mail", ph: "voce@email.com" },
  { v: "PHONE", label: "Celular", ph: "(11) 99999-9999" },
  { v: "RANDOM", label: "Aleatória", ph: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
] as const;

export function PayoutForm({ locale, saved }: { locale: string; saved: { legalName: string; pixKeyType: string | null; pixKeyLast4: string | null } | null }) {
  const [editing, setEditing] = useState(!saved);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await savePayoutAction(prev, fd);
    if (r.ok) setEditing(false); // volta para o resumo depois de salvar
    return r;
  }, {});
  const [pixType, setPixType] = useState<string>(saved?.pixKeyType ?? "CPF");
  const bad = (f: string) => Boolean(state.fields?.includes(f));

  if (saved && !editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div>
          <p className="text-fg">{saved.legalName}</p>
          <p className="text-muted">
            Pix ({PIX_TYPES.find((t) => t.v === saved.pixKeyType)?.label ?? "—"}) final {saved.pixKeyLast4} · CPF guardado cifrado
          </p>
        </div>
        <button onClick={() => setEditing(true)} className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:border-cyan hover:text-fg">
          Alterar
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <p className="text-sm text-muted">Usamos esses dados só para enviar seus ganhos. CPF e chave Pix ficam guardados cifrados.</p>
      <label className="grid gap-1.5 text-sm font-medium text-fg">
        Nome completo (igual ao documento)
        <input name="legalName" required autoComplete="name" defaultValue={saved?.legalName} className={`${input} ${border(bad("legalName"))}`} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-fg">
        CPF
        <input name="cpf" required inputMode="numeric" placeholder="000.000.000-00" maxLength={14} className={`${input} ${border(bad("cpf"))}`} />
      </label>
      <fieldset className="grid gap-1.5 text-sm font-medium text-fg">
        <legend className="mb-1.5">Chave Pix para receber</legend>
        <div className="flex flex-wrap gap-2">
          {PIX_TYPES.map((t) => (
            <label key={t.v} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${pixType === t.v ? "border-pink bg-pink/15 text-fg" : "border-line text-muted"}`}>
              <input type="radio" name="pixKeyType" value={t.v} checked={pixType === t.v} onChange={() => setPixType(t.v)} className="sr-only" />
              {t.label}
            </label>
          ))}
        </div>
        <input
          name="pixKey"
          required
          placeholder={PIX_TYPES.find((t) => t.v === pixType)?.ph}
          className={`${input} mt-2 ${border(bad("pixKey"))}`}
          aria-label="Chave Pix"
        />
        <span className="text-xs font-normal text-muted">A chave precisa estar no seu nome (mesmo titular do CPF).</span>
      </fieldset>
      <label className="flex items-start gap-3 text-sm text-muted">
        <input name="terms" type="checkbox" required className="mt-0.5 size-4 accent-pink" />
        <span>
          Li e aceito o{" "}
          <a href={`/${locale}/termos-anfitriao`} target="_blank" className="text-cyan underline underline-offset-2">Contrato de Intermediação do Anfitrião</a>,
          inclusive os riscos sobre minha conta PSN.
        </span>
      </label>
      <Feedback state={state} okText="Dados salvos!" />
      <div className="flex gap-3">
        <button disabled={pending} className={primary}>{pending ? "Salvando…" : "Salvar e continuar"}</button>
        {saved && (
          <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-line px-4 py-3 text-sm text-muted">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

// ---------- 2 ----------

type ConsoleSaved = { nickname: string; model: string; secondaryOnlineId: string; characterSummary: string; uploadMbps?: number };

export function ConsoleForm({ locale, saved }: { locale: string; saved: ConsoleSaved | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveConsoleAction, {});
  const bad = (f: string) => Boolean(state.fields?.includes(f));
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-fg">
          Nome do anúncio
          <input name="nickname" required maxLength={40} placeholder="PS5 do Lucas · Zona Sul" defaultValue={saved?.nickname} className={`${input} ${border(bad("nickname"))}`} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-fg">
          Modelo
          <select name="model" defaultValue={saved?.model ?? "PS5"} className={`${input} ${border(bad("model"))}`}>
            <option value="PS5">PS5 (com leitor de disco)</option>
            <option value="PS5_DIGITAL">PS5 Digital</option>
            <option value="PS5_PRO">PS5 Pro</option>
          </select>
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-fg">
        Online ID da conta secundária (a que os jogadores vão usar)
        <input name="secondaryOnlineId" required placeholder="ex.: lucas_aluguel" defaultValue={saved?.secondaryOnlineId} className={`${input} ${border(bad("secondaryOnlineId"))}`} />
        <span className="text-xs font-normal text-muted">
          Crie uma conta PSN nova só para isso, sem cartão. Nunca use sua conta principal. A senha dela não é pedida aqui.
        </span>
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-fg">
        Personagem no GTA 6 Online (opcional)
        <input name="characterSummary" maxLength={80} placeholder="ex.: Nível 87 · 4 carros · apartamento" defaultValue={saved?.characterSummary} className={`${input} ${border(bad("characterSummary"))}`} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-fg">
        Velocidade de upload (Mbps)
        <input name="uploadMbps" required inputMode="decimal" placeholder="ex.: 30" defaultValue={saved?.uploadMbps} className={`${input} max-w-40 ${border(bad("uploadMbps"))}`} />
        <span className="text-xs font-normal text-muted">
          No PS5: Configurações → Rede → Status da conexão → Testar conexão com a internet. Use o valor de &quot;Velocidade de upload&quot;. Ideal: 20 Mbps ou mais, com cabo.
        </span>
      </label>
      <Feedback state={state} okText="Console salvo!" />
      <div>
        <button disabled={pending} className={primary}>{pending ? "Salvando…" : saved ? "Salvar alterações" : "Salvar console"}</button>
      </div>
    </form>
  );
}

// ---------- 3 ----------

export function ChecklistForm({ locale, values }: { locale: string; values: Record<string, boolean> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveChecklistAction, {});
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="locale" value={locale} />
      <p className="text-sm text-muted">Faça cada ajuste no seu PS5 e marque. Também conferimos automaticamente quando o console se conecta.</p>
      {CHECKLIST.map((item) => (
        <label key={item.field} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-4 hover:border-cyan/50">
          <input name={item.field} type="checkbox" defaultChecked={values[item.field]} className="mt-1 size-4 shrink-0 accent-pink" />
          <span>
            <span className="block font-semibold text-fg">{item.title}</span>
            <span className="mt-0.5 block text-sm text-muted">{item.how}</span>
          </span>
        </label>
      ))}
      <Feedback state={state} okText="Checklist completo!" />
      <div>
        <button disabled={pending} className={primary}>{pending ? "Salvando…" : "Salvar checklist"}</button>
      </div>
    </form>
  );
}

// ---------- 4 ----------

export function ListedToggle({ locale, listed, canList }: { locale: string; listed: boolean; canList: boolean }) {
  return (
    <form action={toggleListedAction} className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <input type="hidden" name="locale" value={locale} />
      <p className="text-sm text-fg">
        {listed ? "Seu console está anunciado na vitrine." : canList ? "Seu console não está anunciado." : "Aguardando aprovação do cadastro para anunciar."}
      </p>
      <button
        disabled={!listed && !canList}
        className={listed ? "rounded-xl border border-line px-5 py-3 font-semibold text-fg hover:border-pink" : primary}
      >
        {listed ? "Pausar anúncio" : "Anunciar console"}
      </button>
    </form>
  );
}
