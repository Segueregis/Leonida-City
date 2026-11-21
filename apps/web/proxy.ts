import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { defaultLocale, isLocale } from "@/lib/i18n";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";

  // Painel: login do navegador (usuário/senha). A página confere de novo no servidor.
  if (first === "admin") {
    if (isAdminAuthorized(request.headers.get("authorization"))) return;
    return new NextResponse("Acesso restrito", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="LeonidaPlay Admin", charset="UTF-8"', "Cache-Control": "no-store" },
    });
  }

  // Sem idioma na URL → sempre português. Inglês só pelo botão EN (/en).
  if (isLocale(first)) return;
  request.nextUrl.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
