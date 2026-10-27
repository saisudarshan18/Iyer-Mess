import type { Locale } from "./types";

/** Pick the Tamil name when the visitor reads Tamil and one exists. */
export function nameOf(x: { name_en: string; name_ta?: string | null }, locale: string): string {
  return locale === "ta" && x.name_ta ? x.name_ta : x.name_en;
}

/** The other-language name, shown as a small secondary line. */
export function altNameOf(x: { name_en: string; name_ta?: string | null }, locale: string): string | null {
  return locale === "ta" ? x.name_en : x.name_ta || null;
}

export const isLocale = (s: string): s is Locale => s === "en" || s === "ta";
