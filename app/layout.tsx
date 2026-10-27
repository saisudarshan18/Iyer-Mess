import type { Metadata, Viewport } from "next";
import { Literata, Noto_Serif_Tamil } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { pageMeta, SITE_URL } from "@/lib/seo";
import "./globals.css";

// Literata is by TypeTogether, the foundry behind Athelas: a free, close cousin.
const literata = Literata({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  variable: "--font-literata",
  display: "swap",
});

const tamil = Noto_Serif_Tamil({
  subsets: ["tamil"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-tamil",
  display: "swap",
});

export const metadata: Metadata = {
  ...pageMeta(),
  title: { default: "Iyer Mess · Sweets & Savories", template: "%s · Iyer Mess" },
  metadataBase: new URL(SITE_URL),
  applicationName: "Iyer Mess",
  keywords: ["Iyer Mess", "Vellore sweets", "Mysore pak", "murukku", "Deepavali sweets", "South Indian sweets", "Tamil Nadu sweets delivery"],
};

export const viewport: Viewport = {
  themeColor: "#f4ebdd",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${literata.variable} ${tamil.variable}`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
