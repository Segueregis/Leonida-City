import { getMunicipios, isUF } from "@/lib/location";

// Lista oficial de municípios da UF para o autocompletar do campo Cidade.
export async function GET(request: Request) {
  const uf = new URL(request.url).searchParams.get("uf");
  if (!isUF(uf)) return Response.json([], { status: 400 });
  try {
    return Response.json(await getMunicipios(uf), {
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
    });
  } catch {
    return Response.json([], { status: 502 });
  }
}
