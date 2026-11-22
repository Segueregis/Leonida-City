"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@leonidaplay/db";
import { getCurrentUser, requestLoginCode, signOut, verifyLoginCode } from "@/lib/auth";
import { isLocale } from "@/lib/i18n";
import { geoFromHeaders } from "@/lib/location";
import { canSimulatePayments } from "@/lib/mercadopago";
import { createTopUp, markTopUpPaid, MAX_TOPUP_MINOR, refreshTopUp } from "@/lib/wallet";

const loc = (v: FormDataEntryValue | null) => (typeof v === "string" && isLocale(v) ? v : "pt");
const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(200));

// ---------------- Login ----------------

export type LoginState =
  | { step: "email"; error?: "email" | "terms" | "rate" | "send" }
  | { step: "code"; email: string; devCode?: string; error?: "invalid" | "expired" | "blocked" };

export async function loginAction(prev: LoginState, form: FormData): Promise<LoginState> {
  const locale = loc(form.get("locale"));

  if (form.get("intent") === "restart") return { step: "email" };

  if (prev.step === "email" || form.get("intent") === "resend") {
    const email = emailSchema.safeParse(prev.step === "code" ? prev.email : form.get("email"));
    if (!email.success) return { step: "email", error: "email" };
    if (prev.step === "email" && form.get("terms") !== "on") return { step: "email", error: "terms" };
    const r = await requestLoginCode(email.data);
    if (!r.ok) return { step: "email", error: r.code };
    return { step: "code", email: email.data, devCode: r.devCode };
  }

  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { ...prev, error: "invalid" };
  const h = await headers();
  const r = await verifyLoginCode(prev.email, code, {
    locale,
    acceptedTerms: true, // o checkbox é obrigatório no 1º passo
    countryCode: geoFromHeaders(h).country,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: h.get("user-agent") ?? undefined,
  });
  if (!r.ok) return { ...prev, error: r.code };
  redirect(`/${locale}/carteira`);
}

export async function logoutAction(form: FormData) {
  await signOut();
  redirect(`/${loc(form.get("locale"))}/entrar`);
}

// ---------------- Carteira / Pix ----------------

export type TopUpState = { error?: "amount" | "server" };

export async function startTopUpAction(_prev: TopUpState, form: FormData): Promise<TopUpState> {
  const locale = loc(form.get("locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/entrar`);

  const region = await prisma.region.findFirst({ where: { active: true }, select: { minTopUpMinor: true } });
  const min = region?.minTopUpMinor ?? 750;
  const raw = String(form.get("amount") ?? "").replace(/[^\d,.]/g, "").replace(",", ".");
  const amountMinor = Math.round(Number(raw) * 100);
  if (!Number.isFinite(amountMinor) || amountMinor < min || amountMinor > MAX_TOPUP_MINOR) return { error: "amount" };

  // Evita pilha de QRs abertos: reaproveita uma recarga pendente do mesmo valor criada há pouco.
  const reuse = await prisma.topUp.findFirst({
    where: { userId: user.id, amountMinor, status: "PENDING", expiresAt: { gt: new Date(Date.now() + 5 * 60_000) } },
    select: { id: true },
  });
  let id = reuse?.id;
  if (!id) {
    try {
      id = (await createTopUp(user, amountMinor)).id;
    } catch (err) {
      console.error("pix: falha ao criar recarga", err);
      return { error: "server" };
    }
  }
  redirect(`/${locale}/carteira/pix/${id}`);
}

export type PixStatus = { status: "PENDING" | "PAID" | "EXPIRED" | "FAILED" | "REFUNDED" | "NOT_FOUND" };

export async function pollTopUpAction(id: string): Promise<PixStatus> {
  const user = await getCurrentUser();
  if (!user) return { status: "NOT_FOUND" };
  const t = await refreshTopUp(id, user.id);
  return { status: t?.status ?? "NOT_FOUND" };
}

/** Só em modo de teste (mock/sandbox): aprova o Pix sem pagar, pelo mesmo caminho do webhook. */
export async function simulatePaidAction(id: string): Promise<PixStatus> {
  if (!canSimulatePayments()) return { status: "NOT_FOUND" };
  const user = await getCurrentUser();
  if (!user) return { status: "NOT_FOUND" };
  const t = await prisma.topUp.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!t) return { status: "NOT_FOUND" };
  const paid = await markTopUpPaid(t.id, { source: "simulado" });
  return { status: paid.status };
}
