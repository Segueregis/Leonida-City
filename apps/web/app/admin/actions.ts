"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@leonidaplay/db";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { adminActorId } from "@/lib/admin-finance";
import { canSimulatePayments } from "@/lib/mercadopago";
import { markTopUpPaid } from "@/lib/wallet";

async function requireAdmin() {
  if (!isAdminAuthorized((await headers()).get("authorization"))) throw new Error("não autorizado");
  return adminActorId();
}

/** Modo de teste: aprova uma recarga pendente sem Pix real (mesmo caminho do webhook). */
export async function adminSimulatePaid(form: FormData) {
  const adminId = await requireAdmin();
  if (!canSimulatePayments()) throw new Error("simulação desligada em produção");
  const id = String(form.get("id"));
  await markTopUpPaid(id, { source: "simulado pelo admin" });
  await prisma.adminAuditLog.create({ data: { adminId, action: "TOPUP_SIMULATED_PAID", targetType: "TopUp", targetId: id } });
  revalidatePath("/admin/pagamentos");
}

export async function adminToggleBlock(form: FormData) {
  const adminId = await requireAdmin();
  const id = String(form.get("id"));
  const u = await prisma.user.findUniqueOrThrow({ where: { id }, select: { blockedAt: true } });
  const blocking = !u.blockedAt;
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { blockedAt: blocking ? new Date() : null } }),
    // Bloquear derruba as sessões abertas.
    ...(blocking ? [prisma.authSession.deleteMany({ where: { userId: id } })] : []),
    prisma.adminAuditLog.create({ data: { adminId, action: blocking ? "USER_BLOCKED" : "USER_UNBLOCKED", targetType: "User", targetId: id } }),
  ]);
  revalidatePath("/admin/usuarios");
}
