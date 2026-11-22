"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { pollTopUpAction, simulatePaidAction, type PixStatus } from "../../../_app/actions";

type Status = PixStatus["status"];

function useCountdown(expiresAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!expiresAt) return null;
  const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

export function PixWatcher(props: {
  locale: string;
  id: string;
  initialStatus: Status;
  qrBase64: string | null;
  copyPaste: string | null;
  expiresAt: string | null;
  canSimulate: boolean;
}) {
  const [status, setStatus] = useState<Status>(props.initialStatus);
  const [copied, setCopied] = useState(false);
  const [simulating, startSimulate] = useTransition();
  const left = useCountdown(props.expiresAt);

  // Consulta o status a cada 4 s enquanto o Pix está aberto.
  useEffect(() => {
    if (status !== "PENDING") return;
    let live = true;
    const tick = async () => {
      const r = await pollTopUpAction(props.id).catch(() => null);
      if (live && r && r.status !== "PENDING") setStatus(r.status);
    };
    const t = setInterval(tick, 4000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [status, props.id]);

  if (status === "PAID") {
    return (
      <div className="mt-6 grid justify-items-center gap-3">
        <div className="grid size-16 place-items-center rounded-full bg-cyan/15 text-3xl text-cyan" aria-hidden>✓</div>
        <p className="font-display text-xl font-bold text-fg">Pix confirmado!</p>
        <p className="text-sm text-muted">Os créditos já estão na sua carteira.</p>
        <Link href={`/${props.locale}/carteira`} className="mt-2 rounded-xl bg-gradient-to-r from-pink to-purple px-6 py-3 font-semibold text-white">
          Ver meu saldo
        </Link>
      </div>
    );
  }

  if (status !== "PENDING") {
    return (
      <div className="mt-6 grid justify-items-center gap-3">
        <p className="font-display text-lg font-bold text-fg">{status === "EXPIRED" ? "Este Pix expirou" : "Este Pix não está mais disponível"}</p>
        <p className="text-sm text-muted">Se você já pagou, o saldo entra automaticamente. Senão, gere um novo Pix.</p>
        <Link href={`/${props.locale}/carteira`} className="mt-2 rounded-xl border border-line px-6 py-3 font-semibold text-fg hover:border-cyan">
          Gerar novo Pix
        </Link>
      </div>
    );
  }

  const copy = async () => {
    if (!props.copyPaste) return;
    try {
      await navigator.clipboard.writeText(props.copyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* navegador sem permissão: a pessoa copia manualmente do campo */
    }
  };

  return (
    <div className="mt-6 grid justify-items-center gap-5">
      {props.qrBase64 ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem em base64 vinda do Mercado Pago
        <img src={`data:image/png;base64,${props.qrBase64}`} alt="QR Code do Pix" width={240} height={240} className="size-60 rounded-2xl bg-white p-3" />
      ) : (
        <div className="grid size-60 place-items-center rounded-2xl border-2 border-dashed border-line p-6 text-sm text-muted">
          QR Code de teste — no modo real, o QR do Mercado Pago aparece aqui
        </div>
      )}

      <ol className="max-w-sm text-left text-sm text-muted">
        <li>1. Abra o app do seu banco e escolha <b className="text-fg">Pix</b>.</li>
        <li>2. Leia o QR Code ou use o <b className="text-fg">Pix Copia e Cola</b>.</li>
        <li>3. Confirme. Esta tela atualiza sozinha.</li>
      </ol>

      {props.copyPaste && (
        <div className="grid w-full max-w-md gap-2">
          <input readOnly value={props.copyPaste} onFocus={(e) => e.currentTarget.select()} className="w-full truncate rounded-xl border border-line bg-ink px-3 py-2.5 font-mono text-xs text-muted" aria-label="Código Pix copia e cola" />
          <button onClick={copy} className="rounded-xl border border-cyan/50 px-4 py-3 font-semibold text-cyan hover:bg-cyan/10">
            {copied ? "Copiado!" : "Copiar código Pix"}
          </button>
        </div>
      )}

      <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
        <span className="size-2 animate-pulse rounded-full bg-sun" aria-hidden />
        Aguardando pagamento{left ? ` · expira em ${left}` : ""}
      </p>

      {props.canSimulate && (
        <button
          disabled={simulating}
          onClick={() => startSimulate(async () => setStatus((await simulatePaidAction(props.id)).status))}
          className="rounded-xl border border-dashed border-sun/60 px-4 py-2.5 text-sm font-semibold text-sun hover:bg-sun/10 disabled:opacity-60"
        >
          {simulating ? "Aprovando…" : "Simular pagamento aprovado (só no modo de teste)"}
        </button>
      )}
    </div>
  );
}
