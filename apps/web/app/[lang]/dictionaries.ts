import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import type pt from "./dictionaries/pt.json";

export type Dictionary = typeof pt;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  pt: () => import("./dictionaries/pt.json").then((m) => m.default),
  en: () => import("./dictionaries/en.json").then((m) => m.default),
};

export async function getLocale(): Promise<Locale> {
  const l = await lang();
  if (!isLocale(l)) notFound();
  return l;
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()]();
}
