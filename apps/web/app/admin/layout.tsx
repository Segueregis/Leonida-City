import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import "../globals.css";

const unbounded = Unbounded({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-unbounded" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Painel · LeonidaPlay",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#0b0c10" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${unbounded.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
