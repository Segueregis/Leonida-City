// Seguro para client e server.
export const locales = ["pt", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pt";
export const htmlLang: Record<Locale, string> = { pt: "pt-BR", en: "en" };
export const isLocale = (v: string | undefined): v is Locale => v !== undefined && (locales as readonly string[]).includes(v);
