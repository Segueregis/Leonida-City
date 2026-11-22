import { prisma, Prisma } from "@leonidaplay/db";
import { getOrder, paymentMode, verifyWebhookSignature } from "@/lib/mercadopago";
import { applyMpOrder } from "@/lib/wallet";

// Notificações do Mercado Pago (evento "Order", configurado no painel da aplicação → Webhooks).
// Nunca confiamos no corpo: só usamos o ID para buscar a order na API do MP e aplicar o estado oficial (idempotente).

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as { type?: string; action?: string; data?: { id?: string | number } };
  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  const dataId = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "") || null;
  const requestId = request.headers.get("x-request-id");

  const secret = process.env.MP_WEBHOOK_SECRET;
  if (secret) {
    const ok = verifyWebhookSignature({ signature: request.headers.get("x-signature"), requestId, dataId, secret });
    if (!ok) return new Response("assinatura inválida", { status: 401 });
  } else if (paymentMode() === "live") {
    console.error("webhook MP: MP_WEBHOOK_SECRET ausente em produção — notificação recusada");
    return new Response("não configurado", { status: 503 });
  }

  if (type !== "order" || !dataId) return new Response("ok"); // outros tópicos: ignorados

  // Registro único por notificação (o MP reenvia até receber 200).
  const externalId = requestId ?? `${type}:${dataId}:${body.action ?? ""}:${Date.now()}`;
  let eventId: string;
  try {
    const ev = await prisma.webhookEvent.create({
      data: { provider: "MERCADO_PAGO", externalId, type: body.action ?? type, payload: body as Prisma.InputJsonValue },
      select: { id: true },
    });
    eventId = ev.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return new Response("ok (repetida)");
    throw err;
  }

  try {
    const result = await applyMpOrder(await getOrder(dataId));
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date(), error: "ignored" in result ? result.ignored : null },
    });
    return new Response("ok");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("webhook MP: falha ao processar", message);
    await prisma.webhookEvent.update({ where: { id: eventId }, data: { error: message.slice(0, 1000) } });
    return new Response("erro", { status: 500 }); // MP tenta de novo
  }
}
