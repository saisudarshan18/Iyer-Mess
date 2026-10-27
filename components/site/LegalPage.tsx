import Link from "next/link";
import type { Settings } from "@/lib/types";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

/** A blank the owner still has to fill in (Admin → Settings → Content); made obvious on the page. */
export function Blank({ value, label }: { value?: string | null; label: string }) {
  if (value && value.trim()) return <>{value}</>;
  return <mark className="rounded bg-turmeric/35 px-1.5 py-0.5 text-[0.92em] text-ink">[{label}]</mark>;
}

export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: React.ReactNode; sections: LegalSection[] }) {
  return (
    <article className="px-[var(--gutter)] pb-28 pt-32 md:pt-40">
      <p className="kicker">Last updated {updated}</p>
      <h1 className="display mt-4 text-[clamp(3rem,7.5vw,6.5rem)]">{title}</h1>
      <div className="mt-6 max-w-2xl text-lg text-ink-soft">{intro}</div>
      <div className="mt-16 grid gap-12 lg:grid-cols-12">
        <nav aria-label="Sections" className="hidden lg:col-span-3 lg:block">
          <ol className="sticky top-28 space-y-2 text-sm">
            {sections.map((s, i) => (
              <li key={s.id} className="flex gap-3">
                <span className="lnum w-5 text-ink-mute">{String(i + 1).padStart(2, "0")}</span>
                <a href={`#${s.id}`} className="ink-link">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="space-y-12 lg:col-span-8 lg:col-start-5">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-28 border-t border-rule pt-6">
              <h2 className="display flex items-baseline gap-4 text-3xl">
                <span className="lnum text-base text-kumkum">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </h2>
              <div className="prose-legal mt-4 space-y-4 text-[1.02rem] leading-relaxed [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">{s.body}</div>
            </section>
          ))}
          <p className="border-t border-rule pt-6 text-sm text-ink-mute">
            Questions about this page? <Link href="/contact" className="ink-link">Contact us</Link>.
          </p>
        </div>
      </div>
    </article>
  );
}

export function businessLine(s: Settings) {
  return (
    <>
      <Blank value={s.legal.legal_name} label="Business legal name" />, {s.shop_address ?? <Blank label="Shop address" />}
    </>
  );
}
