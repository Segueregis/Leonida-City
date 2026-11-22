"use client";

import { useActionState, useState } from "react";
import { startTopUpAction, type TopUpState } from "../_app/actions";

const brl = (minor: number) => (minor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function TopUpForm({ locale, presets, minMinor }: { locale: string; presets: number[]; minMinor: number }) {
  const [state, action, pending] = useActionState<TopUpState, FormData>(startTopUpAction, {});
  const [amount, setAmount] = useState((presets[2] / 100).toFixed(2).replace(".", ","));

  return (
    <form action={action} className="mt-5 grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {presets.map((p) => {
          const v = (p / 100).toFixed(2).replace(".", ",");
          const active = v === amount;
          return (
            <button
              type="button"
              key={p}
              onClick={() => setAmount(v)}
              aria-pressed={active}
              className={`rounded-xl border px-3 py-3 text-sm font-semibold tabular-nums transition ${
                active ? "border-pink bg-pink/15 text-fg" : "border-line text-muted hover:border-cyan hover:text-fg"
              }`}
            >
              {brl(p)}
            </button>
          );
        })}
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-fg">
        Outro valor
        <div className="flex items-center rounded-xl border border-line bg-ink focus-within:border-cyan">
          <span className="pl-4 text-muted">R$</span>
          <input
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            required
            className="w-full bg-transparent px-2 py-3 tabular-nums text-fg focus:outline-none"
          />
        </div>
        <span className="text-xs font-normal text-muted">Mínimo {brl(minMinor)} · máximo R$ 500,00 por recarga</span>
      </label>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-sun">
          {state.error === "amount" ? `Escolha um valor entre ${brl(minMinor)} e R$ 500,00.` : "Não conseguimos gerar o Pix agora. Tente de novo."}
        </p>
      )}
      <button
        disabled={pending}
        className="rounded-xl bg-gradient-to-r from-pink to-purple px-5 py-3.5 font-semibold text-white shadow-lg shadow-pink/25 transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Gerando Pix…" : "Gerar Pix"}
      </button>
    </form>
  );
}
