"use client";

import { startTransition, useActionState, useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { joinWaitlist, type WaitlistState } from "../actions";
import type { Dictionary } from "../dictionaries";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

type Kind = "PLAYER" | "HOST";

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function WaitlistForm({ t, locale }: { t: Dictionary["form"]; locale: string }) {
  const [chosen, setKind] = useState<Kind | null>(null);
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlist, { status: "idle" });

  // Aba inicial vem do link clicado (#lista-anfitriao / ?tipo=anfitriao); clique na aba sobrepõe.
  const hostLink = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash === "#lista-anfitriao" || new URLSearchParams(window.location.search).get("tipo") === "anfitriao",
    () => false,
  );
  const kind: Kind = chosen ?? (hostLink ? "HOST" : "PLAYER");

  // Novo clique num link do hero volta a valer sobre a escolha manual.
  useEffect(() => {
    const reset = () => setKind(null);
    window.addEventListener("hashchange", reset);
    return () => window.removeEventListener("hashchange", reset);
  }, []);

  // Envio manual: com <form action> o React 19 limpa os campos ao terminar — ruim quando há erro.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    data.set("utm", new URLSearchParams(window.location.search).get("utm_source") ?? "");
    startTransition(() => action(data));
  };

  const bad = (f: string) => state.status === "error" && state.fields?.includes(f);
  const field =
    "w-full rounded-xl border bg-ink/70 px-4 py-3 text-fg placeholder:text-muted/60 outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/30";
  const ok = "border-line";
  const err = "border-pink ring-2 ring-pink/30";

  if (state.status === "success") {
    return (
      <div role="status" className="rounded-2xl border border-cyan/40 bg-cyan/5 p-8 text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-cyan/15 text-2xl text-cyan">✓</div>
        <p className="text-lg text-fg">{state.kind === "HOST" ? t.successHost : t.successPlayer}</p>
      </div>
    );
  }

  return (
    <div>
      <div role="tablist" aria-label={t.title} className="mb-6 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-ink/60 p-1">
        {(["PLAYER", "HOST"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              kind === k ? "bg-gradient-to-r from-pink to-purple text-white shadow-lg shadow-pink/20" : "text-muted hover:text-fg"
            }`}
          >
            {k === "PLAYER" ? t.tabPlayer : t.tabHost}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="locale" value={locale} />
        {/* honeypot */}
        <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
          <label>
            Empresa <input name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm text-muted sm:col-span-2">
            {t.email} *
            <input name="email" type="email" required autoComplete="email" inputMode="email" className={`${field} ${bad("email") ? err : ok}`} />
          </label>
          <label className="grid gap-1.5 text-sm text-muted">
            {t.name}
            <input name="name" autoComplete="given-name" maxLength={80} className={`${field} ${ok}`} />
          </label>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <label className="grid gap-1.5 text-sm text-muted">
              {t.city}
              <input name="city" autoComplete="address-level2" maxLength={80} className={`${field} ${ok}`} />
            </label>
            <label className="grid gap-1.5 text-sm text-muted">
              {t.state}
              <select name="state" defaultValue="" className={`${field} ${bad("state") ? err : ok}`}>
                <option value="">{t.statePlaceholder}</option>
                {UFS.map((uf) => (
                  <option key={uf}>{uf}</option>
                ))}
                <option value="EX">—</option>
              </select>
            </label>
          </div>
        </div>

        {kind === "PLAYER" ? (
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm text-muted">{t.device}</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(t.devices).map(([v, label]) => (
                <label key={v} className="cursor-pointer">
                  <input type="radio" name="device" value={v} className="peer sr-only" />
                  <span className="inline-block rounded-full border border-line px-4 py-2 text-sm text-muted transition peer-checked:border-cyan peer-checked:bg-cyan/10 peer-checked:text-cyan peer-focus-visible:ring-2 peer-focus-visible:ring-cyan/40">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm text-muted">
              {t.consoleModel}
              <select name="consoleModel" defaultValue="" className={`${field} ${ok}`}>
                <option value="">—</option>
                {Object.entries(t.consoleModels).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 text-sm text-muted">{t.hasGame}</legend>
              <div className="flex gap-2">
                {[
                  ["yes", t.yes],
                  ["no", t.no],
                ].map(([v, label]) => (
                  <label key={v} className="flex-1 cursor-pointer">
                    <input type="radio" name="hasGame" value={v} className="peer sr-only" />
                    <span className="block rounded-xl border border-line px-4 py-3 text-center text-sm text-muted transition peer-checked:border-cyan peer-checked:bg-cyan/10 peer-checked:text-cyan peer-focus-visible:ring-2 peer-focus-visible:ring-cyan/40">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="grid gap-1.5 text-sm text-muted">
              {t.upload}
              <select name="uploadMbps" defaultValue="" className={`${field} ${ok}`}>
                <option value="">—</option>
                <option value="<10">&lt; 10 Mbps</option>
                <option value="10-20">10–20 Mbps</option>
                <option value="20-50">20–50 Mbps</option>
                <option value="50+">50+ Mbps</option>
                <option value="unknown">{t.uploadDontKnow}</option>
              </select>
              <span className="text-xs text-muted/70">{t.uploadHint}</span>
            </label>
            <label className="grid gap-1.5 text-sm text-muted">
              {t.hours}
              <input name="hoursPerDay" type="number" min={0} max={24} inputMode="numeric" className={`${field} ${bad("hoursPerDay") ? err : ok}`} />
            </label>
            <label className="grid gap-1.5 text-sm text-muted sm:col-span-2">
              {t.whatsapp}
              <input name="whatsapp" type="tel" autoComplete="tel" placeholder="+55 11 91234-5678" className={`${field} ${bad("whatsapp") ? err : ok}`} />
            </label>
            <label className="flex items-center gap-3 text-sm text-fg sm:col-span-2">
              <input type="checkbox" name="beta" defaultChecked className="size-5 accent-pink" />
              {t.beta}
            </label>
          </div>
        )}

        <label className={`flex items-start gap-3 rounded-xl p-2 text-xs leading-relaxed text-muted ${bad("consent") ? "ring-2 ring-pink/40" : ""}`}>
          <input type="checkbox" name="consent" required className="mt-0.5 size-5 shrink-0 accent-pink" />
          {t.consent}
        </label>

        {state.status === "error" && (
          <p role="alert" className="rounded-xl border border-pink/40 bg-pink/10 px-4 py-3 text-sm text-pink">
            {t.errors[state.code]}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink via-purple to-cyan p-px font-semibold disabled:opacity-60"
        >
          <span className="block rounded-[15px] bg-ink/10 px-6 py-4 text-white transition group-hover:bg-transparent">
            {pending ? t.submitting : t.submit}
          </span>
        </button>
      </form>
    </div>
  );
}
