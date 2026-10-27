import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Kolam } from "@/components/art/Kolam";
import { PhoneGate } from "@/components/account/PhoneGate";
import { getSessionProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "One more step", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function WelcomePage({ searchParams }: Props) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/welcome") ? next : "/orders";
  const { user, profile } = await getSessionProfile();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeNext)}`);
  if (profile?.phone) redirect(safeNext);
  const t = await getTranslations("welcome");
  return (
    <section className="relative grid min-h-[100svh] items-center overflow-hidden px-[var(--gutter)] pb-20 pt-32">
      <div className="pointer-events-none absolute -right-[20vw] top-1/2 w-[80vw] max-w-[900px] -translate-y-1/2 text-brass/30" aria-hidden>
        <Kolam size={900} lobes={10} strokeWidth={1.2} />
      </div>
      <div className="relative mx-auto w-full max-w-md rounded-[32px] bg-paper/90 p-8 shadow-[0_40px_80px_-40px_rgba(42,26,18,.5),inset_0_0_0_1px_var(--rule)] backdrop-blur md:p-10">
        <p className="kicker">{t("kicker")}</p>
        <h1 className="display mt-3 text-5xl">{t("title")}</h1>
        <p className="mb-8 mt-3 text-ink-soft">{t("sub", { email: user.email ?? "" })}</p>
        <PhoneGate
          next={safeNext}
          defaultName={profile?.name ?? ((user.user_metadata?.full_name ?? user.user_metadata?.name) as string | undefined) ?? ""}
        />
      </div>
    </section>
  );
}
