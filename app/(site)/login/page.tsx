import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Kolam } from "@/components/art/Kolam";
import { LoginForm } from "@/components/account/LoginForm";

export const metadata: Metadata = { title: "Log in" };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const t = await getTranslations("login");
  const { next, error } = await searchParams;
  // only allow same-site relative redirects
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/orders";
  return (
    <section className="relative grid min-h-[100svh] items-center overflow-hidden px-[var(--gutter)] pb-20 pt-32">
      <div className="pointer-events-none absolute -left-[20vw] top-1/2 w-[80vw] max-w-[900px] -translate-y-1/2 text-brass/30" aria-hidden>
        <Kolam size={900} lobes={12} strokeWidth={1.2} />
      </div>
      <div className="relative mx-auto w-full max-w-md rounded-[32px] bg-paper/90 p-8 shadow-[0_40px_80px_-40px_rgba(42,26,18,.5),inset_0_0_0_1px_var(--rule)] backdrop-blur md:p-10">
        <h1 className="display text-6xl">{t("title")}</h1>
        <p className="mb-8 mt-3 text-ink-soft">{t("sub")}</p>
        {error && <p className="mb-6 rounded-xl bg-kumkum/10 px-4 py-3 text-sm text-kumkum">{t.has(`err.${error}`) ? t(`err.${error}`) : t("err.google_failed")}</p>}
        <LoginForm next={safeNext} nonce={(await headers()).get("x-nonce") ?? undefined} />
      </div>
    </section>
  );
}
