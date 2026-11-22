import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@leonidaplay/db";
import { sendLoginCode } from "./email";

// Login sem senha: a pessoa digita o e-mail, recebe um código de 6 dígitos e entra.
// Banco guarda só hashes (código e token de sessão) — um vazamento do banco não dá acesso a contas.

export const SESSION_COOKIE = "lp_session";
const SESSION_DAYS = 30;
const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5; // erros por código antes de invalidá-lo
const MAX_CODES_PER_HOUR = 5; // pedidos de código por e-mail

/** Versões dos documentos aceitos no cadastro. Trocar a versão quando o texto mudar. */
export const TERMS_VERSION = "2026-11-22";

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET ausente ou curto (mín. 32 caracteres)");
  return "leonidaplay-dev-auth-secret-nao-usar-em-producao";
};
const hash = (value: string) => createHash("sha256").update(`${secret()}:${value}`).digest("hex");

export type RequestCodeResult = { ok: true; devCode?: string } | { ok: false; code: "rate" | "send" };

export async function requestLoginCode(email: string): Promise<RequestCodeResult> {
  const recent = await prisma.verificationToken.count({
    where: { identifier: email, createdAt: { gte: new Date(Date.now() - 3600_000) } },
  });
  if (recent >= MAX_CODES_PER_HOUR) return { ok: false, code: "rate" };

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  // Um código válido por vez: pedir outro invalida os anteriores (mantém o histórico para o limite por hora).
  await prisma.verificationToken.updateMany({
    where: { identifier: email, expires: { gt: new Date() } },
    data: { expires: new Date() },
  });
  await prisma.verificationToken.create({
    data: { identifier: email, token: hash(`${email}:${code}`), expires: new Date(Date.now() + CODE_TTL_MIN * 60_000) },
  });

  const sent = await sendLoginCode(email, code);
  if (sent === "failed") return { ok: false, code: "send" };
  // Sem provedor de e-mail configurado (só fora de produção), o código aparece na tela para testar.
  return sent === "dev" ? { ok: true, devCode: code } : { ok: true };
}

export type VerifyResult = { ok: true; userId: string; isNew: boolean } | { ok: false; code: "invalid" | "expired" | "blocked" };

export async function verifyLoginCode(
  email: string,
  code: string,
  meta: { countryCode?: string; ip?: string; userAgent?: string; locale: string; acceptedTerms: boolean },
): Promise<VerifyResult> {
  const current = await prisma.verificationToken.findFirst({
    where: { identifier: email, expires: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!current) return { ok: false, code: "expired" };

  const expected = Buffer.from(current.token);
  const given = Buffer.from(hash(`${email}:${code}`));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    const attempts = current.attempts + 1;
    await prisma.verificationToken.update({
      where: { token: current.token },
      data: attempts >= MAX_ATTEMPTS ? { attempts, expires: new Date() } : { attempts },
    });
    return { ok: false, code: attempts >= MAX_ATTEMPTS ? "expired" : "invalid" };
  }
  await prisma.verificationToken.update({ where: { token: current.token }, data: { expires: new Date() } });

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, blockedAt: true } });
  if (existing?.blockedAt) return { ok: false, code: "blocked" };

  const region = existing ? null : await prisma.region.findFirst({ where: { active: true }, select: { id: true } });
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { emailVerified: new Date() }, select: { id: true } })
    : await prisma.user.create({
        data: {
          email,
          emailVerified: new Date(),
          locale: meta.locale === "en" ? "en" : "pt-BR",
          countryCode: meta.countryCode,
          regionId: region?.id,
        },
        select: { id: true },
      });

  if (!existing && meta.acceptedTerms) {
    const evidence = { ipAddress: meta.ip ? meta.ip.slice(0, 64) : undefined, userAgent: meta.userAgent?.slice(0, 300) };
    await prisma.termsAcceptance.createMany({
      data: [
        { userId: user.id, document: "PLAYER_TERMS", version: TERMS_VERSION, ...evidence },
        { userId: user.id, document: "PRIVACY_POLICY", version: TERMS_VERSION, ...evidence },
      ],
    });
  }

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await prisma.authSession.create({ data: { sessionToken: hash(`session:${token}`), userId: user.id, expires } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  return { ok: true, userId: user.id, isNew: !existing };
}

/** Usuário logado (ou null). Lê o cookie — chamar dentro de <Suspense> ou Server Action. */
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { sessionToken: hash(`session:${token}`) },
    select: { expires: true, user: { select: { id: true, email: true, name: true, blockedAt: true, regionId: true } } },
  });
  if (!session || session.expires < new Date() || session.user.blockedAt) return null;
  return session.user;
}

export async function signOut() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.authSession.deleteMany({ where: { sessionToken: hash(`session:${token}`) } });
  store.delete(SESSION_COOKIE);
}
