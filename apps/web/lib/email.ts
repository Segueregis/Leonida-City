import "server-only";

// Envio do código de login. Provedor: Resend (API HTTP simples, sem SDK).
// Fora de produção → modo de teste: o código aparece na tela e no terminal.

export async function sendLoginCode(email: string, code: string): Promise<"sent" | "dev" | "failed"> {
  const key = process.env.RESEND_API_KEY;
  // Em desenvolvimento não enviamos e-mail de verdade (endereços de teste geram devolução e prejudicam o domínio).
  // Para testar o envio real localmente: EMAIL_SEND_IN_DEV=1.
  if (!key || (process.env.NODE_ENV !== "production" && process.env.EMAIL_SEND_IN_DEV !== "1")) {
    if (process.env.NODE_ENV === "production") {
      console.error("email: RESEND_API_KEY ausente em produção");
      return "failed";
    }
    console.info(`[login] código para ${email}: ${code}`);
    return "dev";
  }

  const from = process.env.EMAIL_FROM ?? "LeonidaPlay <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `${code} é seu código LeonidaPlay`,
        text: `Seu código para entrar na LeonidaPlay é ${code}.\n\nEle vale por 10 minutos. Se não foi você, ignore este e-mail.`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px">
<p style="font-size:15px;color:#333">Seu código para entrar na <b>LeonidaPlay</b>:</p>
<p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:16px 0;color:#111">${code}</p>
<p style="font-size:13px;color:#666">Vale por 10 minutos. Se não foi você, ignore este e-mail.</p></div>`,
      }),
    });
    if (!res.ok) {
      console.error("email: Resend respondeu", res.status, await res.text().catch(() => ""));
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error("email: falha ao enviar", err);
    return "failed";
  }
}
