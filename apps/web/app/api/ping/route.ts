import { connection } from "next/server";

// Alvo do teste de conexão da vitrine: resposta mínima, sem cache, servida em São Paulo (vercel.json → gru1).
export async function GET() {
  await connection();
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
