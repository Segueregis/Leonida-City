"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, Prisma } from "@leonidaplay/db";
import { getCurrentUser } from "@/lib/auth";
import { isValidCPF, last4, normalizePixKey, onlyDigits } from "@/lib/br";
import { encrypt, fingerprint } from "@/lib/crypto";
import { CHECKLIST, HOST_TERMS_VERSION } from "@/lib/host-checklist";
import { isLocale } from "@/lib/i18n";

export type FormState = { ok?: boolean; error?: string; fields?: string[] };

const loc = (v: FormDataEntryValue | null) => (typeof v === "string" && isLocale(v) ? v : "pt");

async function requireUser(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${loc(form.get("locale"))}/entrar?next=/${loc(form.get("locale"))}/anfitriao`);
  return user;
}

// ---------- 1. Dados para repasse + contrato ----------

const payoutSchema = z.object({
  legalName: z.string().trim().min(5).max(120).regex(/\s/, "nome completo"),
  cpf: z.string().refine(isValidCPF),
  pixKeyType: z.enum(["CPF", "EMAIL", "PHONE", "RANDOM"]),
  pixKey: z.string().trim().min(3).max(120),
  terms: z.literal("on"),
});

export async function savePayoutAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(form);
  const parsed = payoutSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    const msg = fields.includes("cpf")
      ? "CPF inválido. Confira os números."
      : fields.includes("legalName")
        ? "Escreva seu nome completo, igual ao documento."
        : fields.includes("terms")
          ? "Para continuar, aceite o Contrato de Intermediação."
          : "Confira os campos destacados.";
    return { error: msg, fields };
  }
  const d = parsed.data;
  const cpf = onlyDigits(d.cpf);
  const pixKey = normalizePixKey(d.pixKeyType, d.pixKey);
  if (!pixKey) return { error: "Chave Pix inválida para o tipo escolhido.", fields: ["pixKey"] };
  // Repasse sempre para o próprio titular (comprovação fiscal do repasse).
  if (d.pixKeyType === "CPF" && pixKey !== cpf) return { error: "A chave Pix CPF precisa ser o seu próprio CPF.", fields: ["pixKey"] };

  const documentHash = fingerprint(`cpf:${cpf}`);
  const other = await prisma.hostProfile.findFirst({ where: { documentHash, NOT: { userId: user.id } }, select: { id: true } });
  if (other) return { error: "Este CPF já está cadastrado em outra conta de anfitrião. Fale com o suporte.", fields: ["cpf"] };

  const h = await headers();
  const data = {
    legalName: d.legalName.replace(/\s+/g, " "),
    documentEncrypted: encrypt(cpf),
    documentHash,
    payoutMethod: "PIX" as const,
    pixKeyType: d.pixKeyType,
    pixKeyEncrypted: encrypt(pixKey),
    pixKeyLast4: last4(pixKey),
  };
  try {
    await prisma.$transaction([
      prisma.hostProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data }),
      prisma.termsAcceptance.create({
        data: {
          userId: user.id,
          document: "HOST_INTERMEDIATION_AGREEMENT",
          version: HOST_TERMS_VERSION,
          ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64),
          userAgent: h.get("user-agent")?.slice(0, 300),
        },
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Este CPF já está cadastrado em outra conta de anfitrião.", fields: ["cpf"] };
    }
    throw err;
  }
  revalidatePath(`/${loc(form.get("locale"))}/anfitriao`);
  return { ok: true };
}

// ---------- 2. Console ----------

const consoleSchema = z.object({
  nickname: z.string().trim().min(3).max(40),
  model: z.enum(["PS5", "PS5_DIGITAL", "PS5_PRO"]),
  secondaryOnlineId: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_-]{2,15}$/),
  characterSummary: z.string().trim().max(80).optional().transform((v) => v || null),
  uploadMbps: z.coerce.number().min(1).max(2000),
});

export async function saveConsoleAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(form);
  const host = await prisma.hostProfile.findUnique({ where: { userId: user.id }, select: { id: true, consoles: { take: 1, select: { id: true } } } });
  if (!host) return { error: "Preencha primeiro os dados para receber." };

  const parsed = consoleSchema.safeParse(Object.fromEntries([...form].filter(([, v]) => v !== "")));
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    return {
      error: fields.includes("secondaryOnlineId")
        ? "Online ID inválido: 3 a 16 caracteres, começando com letra (letras, números, - e _)."
        : fields.includes("uploadMbps")
          ? "Informe a velocidade de upload em Mbps (só o número)."
          : "Confira os campos destacados.",
      fields,
    };
  }
  const d = parsed.data;
  const region = await prisma.region.findFirst({ where: { active: true }, select: { id: true } });
  if (!region) return { error: "Região indisponível. Tente mais tarde." };

  const data = {
    nickname: d.nickname,
    model: d.model,
    secondaryOnlineId: d.secondaryOnlineId,
    characterSummary: d.characterSummary,
    measuredUploadMbps: d.uploadMbps, // declarado pelo anfitrião; o relay substitui pela medição real
  };
  const existing = host.consoles[0];
  if (existing) await prisma.console.update({ where: { id: existing.id }, data });
  else await prisma.console.create({ data: { ...data, hostId: host.id, regionId: region.id } });

  revalidatePath(`/${loc(form.get("locale"))}/anfitriao`);
  return { ok: true };
}

// ---------- 3. Checklist ----------

export async function saveChecklistAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(form);
  const c = await prisma.console.findFirst({ where: { host: { userId: user.id } }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!c) return { error: "Cadastre o console primeiro." };

  const values = Object.fromEntries(CHECKLIST.map((item) => [item.field, form.get(item.field) === "on"])) as Record<string, boolean>;
  const all = Object.values(values).every(Boolean);
  await prisma.console.update({
    where: { id: c.id },
    data: { ...values, checklistVerifiedAt: all ? new Date() : null, ...(all ? {} : { listed: false }) },
  });
  revalidatePath(`/${loc(form.get("locale"))}/anfitriao`);
  return all ? { ok: true } : { error: "Marque todos os itens. Sem eles, não dá para anunciar o console com segurança." };
}

// ---------- 4. Anunciar ----------

export async function toggleListedAction(form: FormData) {
  const user = await requireUser(form);
  const c = await prisma.console.findFirst({
    where: { host: { userId: user.id } },
    orderBy: { createdAt: "asc" },
    select: { id: true, listed: true, checklistVerifiedAt: true, host: { select: { status: true } } },
  });
  if (!c) return;
  const listing = !c.listed;
  // Só anuncia com checklist completo e anfitrião aprovado. Retirar o anúncio é sempre permitido.
  if (listing && (!c.checklistVerifiedAt || c.host.status !== "ACTIVE")) return;
  await prisma.console.update({ where: { id: c.id }, data: { listed: listing } });
  revalidatePath(`/${loc(form.get("locale"))}/anfitriao`);
}
