import { headers } from "next/headers";
import { geoFromHeaders } from "@/lib/location";

// Sugere cidade/UF no formulário a partir do IP (só pré-preenche; a pessoa pode trocar).
export async function GET() {
  const { city, uf, country } = geoFromHeaders(await headers());
  return Response.json(
    { city: uf ? city : undefined, uf, country },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
