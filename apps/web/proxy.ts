import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, locales } from "@/lib/i18n";

// Sem idioma na URL → redireciona conforme Accept-Language (pt é o padrão).
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (isLocale(first)) return;

  const accept = request.headers.get("accept-language")?.toLowerCase() ?? "";
  const preferred = accept
    .split(",")
    .map((p) => p.split(";")[0].trim().slice(0, 2))
    .find((l) => isLocale(l));
  const locale = preferred && (locales as readonly string[]).includes(preferred) ? preferred : defaultLocale;

  request.nextUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
