"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@leonidaplay/db";
import { isLocale } from "@/lib/i18n";
import { canonicalCity, geoFromHeaders } from "@/lib/location";

export type WaitlistState =
  | { status: "idle" }
  | { status: "success"; kind: "PLAYER" | "HOST" }
  | { status: "error"; code: "email" | "consent" | "invalid" | "rate" | "server"; fields?: string[] };

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO","EX"] as const;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

const base = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(200)),
  name: optionalText(80),
  city: optionalText(80),
  state: z.enum(UFS).optional(),
  locale: z.string().refine(isLocale),
  consent: z.literal("on"),
  utm: optionalText(60),
});

const player = base.extend({
  kind: z.literal("PLAYER"),
  device: z.enum(["PC", "NOTEBOOK", "CELULAR", "TABLET", "TV"]).optional(),
});

const host = base.extend({
  kind: z.literal("HOST"),
  consoleModel: z.enum(["PS5", "PS5_DIGITAL", "PS5_PRO"]).optional(),
  hasGame: z.enum(["yes", "no"]).optional(),
  uploadMbps: z.enum(["<10", "10-20", "20-50", "50+", "unknown"]).optional(),
  hoursPerDay: z.coerce.number().int().min(0).max(24).optional(),
  whatsapp: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s()-]*$/)
    .optional()
    .transform((v) => (v ? v : undefined)),
  beta: z.literal("on").optional(),
});

const schema = z.discriminatedUnion("kind", [player, host]);

const MAX_PER_IP_PER_HOUR = 8;

export async function joinWaitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  // Honeypot: bots preenchem o campo escondido; fingimos sucesso.
  if (formData.get("company")) return { status: "success", kind: "PLAYER" };

  const raw: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of formData.entries()) if (!k.startsWith("$ACTION") && v !== "") raw[k] = v;

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    if (fields.includes("consent")) return { status: "error", code: "consent", fields };
    if (fields.includes("email")) return { status: "error", code: "email", fields };
    return { status: "error", code: "invalid", fields };
  }
  const d = parsed.data;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  const salt = process.env.WAITLIST_IP_SALT ?? "leonidaplay-dev-salt";
  const ipHash = ip ? createHash("sha256").update(ip + salt).digest("hex") : null;

  try {
    if (ipHash) {
      const recent = await prisma.waitlistEntry.count({
        where: { ipHash, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      });
      if (recent >= MAX_PER_IP_PER_HOUR) return { status: "error", code: "rate" };
    }

    const geo = geoFromHeaders(h);
    const common = {
      name: d.name,
      city: await canonicalCity(d.city, d.state),
      state: d.state,
      locale: d.locale,
      countryCode: geo.country,
      ipCity: geo.city,
      ipRegion: geo.region,
      consentAt: new Date(),
      ipHash,
      userAgent: h.get("user-agent")?.slice(0, 300),
      utmSource: d.utm,
    };
    const specific =
      d.kind === "PLAYER"
        ? { device: d.device }
        : {
            consoleModel: d.consoleModel,
            hasGame: d.hasGame === undefined ? undefined : d.hasGame === "yes",
            uploadMbps: d.uploadMbps,
            hoursPerDay: d.hoursPerDay,
            whatsapp: d.whatsapp,
            betaTester: d.beta === "on",
          };

    // Reenvio com o mesmo e-mail atualiza o cadastro (não revela se já existia).
    await prisma.waitlistEntry.upsert({
      where: { kind_email: { kind: d.kind, email: d.email } },
      create: { kind: d.kind, email: d.email, ...common, ...specific },
      update: { ...common, ...specific },
    });
    return { status: "success", kind: d.kind };
  } catch (err) {
    console.error("waitlist: falha ao salvar", err);
    return { status: "error", code: "server" };
  }
}
