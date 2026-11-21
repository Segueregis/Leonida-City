import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { htmlLang, locales } from "@/lib/i18n";
import { getDictionary, getLocale } from "./dictionaries";
import "../globals.css";

const unbounded = Unbounded({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-unbounded" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  const locale = await getLocale();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: t.meta.title,
    description: t.meta.description,
    alternates: { canonical: `/${locale}`, languages: { "pt-BR": "/pt", en: "/en" } },
    openGraph: { title: t.meta.title, description: t.meta.description, type: "website", locale: htmlLang[locale] },
  };
}

export const viewport: Viewport = { themeColor: "#0b0c10" };

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  return (
    <html lang={htmlLang[locale]} className={`${unbounded.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
