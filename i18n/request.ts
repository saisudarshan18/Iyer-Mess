import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import type { Locale } from "@/lib/types";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export default getRequestConfig(async () => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = value === "ta" ? "ta" : "en";
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
