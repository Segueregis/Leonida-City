"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../_app/actions";

const ERRORS: Record<string, string> = {
  email: "Confira o e-mail digitado.",
  terms: "Para continuar, confirme que tem 18 anos ou mais e aceite os Termos de Uso e a Política de Privacidade.",
  rate: "Muitos códigos pedidos. Espere um pouco e tente de novo.",
  send: "Não conseguimos enviar o e-mail agora. Tente de novo em instantes.",
  invalid: "Código incorreto. Confira e tente de novo.",
  expired: "Esse código expirou ou foi usado. Peça um novo.",
  blocked: "Esta conta está bloqueada. Fale com o suporte.",
};

const input =
  "w-full rounded-xl border border-line bg-ink px-4 py-3 text-fg placeholder:text-muted/60 focus:border-cyan focus:outline-none";
const primary =
  "w-full rounded-xl bg-gradient-to-r from-pink to-purple px-5 py-3.5 font-semibold text-white shadow-lg shadow-pink/25 transition hover:brightness-110 disabled:opacity-60";

export function LoginForm({ locale }: { locale: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { step: "email" });
  const error = state.error ? ERRORS[state.error] : null;

  if (state.step === "email") {
    return (
      <form action={action} className="mt-6 grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <label className="grid gap-1.5 text-sm font-medium text-fg">
          E-mail
          <input name="email" type="email" required autoComplete="email" inputMode="email" placeholder="voce@email.com" className={input} />
        </label>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input name="terms" type="checkbox" required className="mt-0.5 size-4 accent-pink" />
          <span>
            Tenho 18 anos ou mais e aceito os{" "}
            <a href={`/${locale}/termos`} target="_blank" className="text-cyan underline underline-offset-2">Termos de Uso</a> e a{" "}
            <a href={`/${locale}/privacidade`} target="_blank" className="text-cyan underline underline-offset-2">Política de Privacidade</a>.
          </span>
        </label>
        {error && <p role="alert" className="text-sm font-medium text-sun">{error}</p>}
        <button disabled={pending} className={primary}>
          {pending ? "Enviando…" : "Receber código"}
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="mt-6 grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <p className="text-sm text-muted">
        Enviamos o código para <b className="text-fg">{state.email}</b>. Vale por 10 minutos.
      </p>
      {state.devCode && (
        <p className="rounded-xl border border-sun/40 bg-sun/10 px-4 py-3 text-sm text-sun">
          Modo de teste (sem envio de e-mail): seu código é <b className="font-mono text-base tracking-widest">{state.devCode}</b>
        </p>
      )}
      <label className="grid gap-1.5 text-sm font-medium text-fg">
        Código
        <input
          name="code"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          placeholder="000000"
          className={`${input} text-center font-mono text-2xl tracking-[0.5em]`}
        />
      </label>
      {error && <p role="alert" className="text-sm font-medium text-sun">{error}</p>}
      <button disabled={pending} className={primary}>
        {pending ? "Conferindo…" : "Entrar"}
      </button>
      <div className="flex justify-between text-sm">
        <button name="intent" value="restart" formNoValidate className="text-muted underline-offset-2 hover:text-fg hover:underline">
          Trocar e-mail
        </button>
        <button name="intent" value="resend" formNoValidate className="text-cyan underline-offset-2 hover:underline">
          Enviar novo código
        </button>
      </div>
    </form>
  );
}
