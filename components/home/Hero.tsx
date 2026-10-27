"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { Kolam } from "@/components/art/Kolam";
import { SweetGlyph } from "@/components/art/SweetGlyph";
import { SplitReveal, Reveal } from "@/components/motion/Reveal";
import { Magnetic } from "@/components/motion/Magnetic";
import { gsap, useGsap } from "@/components/motion/useGsap";
import { useStore } from "@/components/site/StoreProvider";

// sweets arranged on the brass plate: [slug, left%, top%, size%, parallax depth, rotation]
const PLATE: [string, number, number, number, number, number][] = [
  ["jangiri", 14, 10, 38, 0.55, -8],
  ["laddu", 52, 14, 34, 0.8, 0],
  ["ghee-mysore-pak", 46, 50, 36, 1.15, 10],
  ["mullu-murukku", 8, 50, 38, 0.95, 0],
  ["badhusha", 30, 32, 30, 1.35, -4],
];

export function Hero() {
  const t = useTranslations("hero");
  const tn = useTranslations();
  const locale = useLocale();
  const { settings, products } = useStore();
  const ref = useRef<HTMLElement>(null);
  const sweets = products.filter((p) => p.category === "sweet").length;
  const savories = products.filter((p) => p.category === "savory").length;

  useGsap(ref, (mm, el) => {
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // kolam draws itself on load, then keeps turning as you scroll away
      const paths = el.querySelectorAll<SVGGeometryElement>("[data-kolam] [data-draw]");
      paths.forEach((p) => {
        const len = p.getTotalLength();
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      });
      gsap.to(paths, { strokeDashoffset: 0, duration: 3.2, ease: "power2.inOut", stagger: 0.25, delay: 0.2 });
      gsap.from(el.querySelectorAll("[data-kolam] [data-dot]"), { scale: 0, transformOrigin: "center", duration: 0.6, stagger: 0.03, delay: 1.4, ease: "back.out(3)" });

      const scroll = { trigger: el, start: "top top", end: "bottom top", scrub: true };
      gsap.to("[data-kolam]", { rotate: 50, yPercent: 18, ease: "none", scrollTrigger: scroll });
      gsap.to("[data-plate]", { yPercent: 22, rotate: -6, ease: "none", scrollTrigger: scroll });
      el.querySelectorAll<HTMLElement>("[data-depth]").forEach((node) => {
        const depth = Number(node.dataset.depth);
        gsap.to(node, { yPercent: -60 * depth, rotate: `+=${depth * 14}`, ease: "none", scrollTrigger: scroll });
      });
      gsap.to("[data-word='1']", { xPercent: -8, ease: "none", scrollTrigger: scroll });
      gsap.to("[data-word='2']", { xPercent: 10, ease: "none", scrollTrigger: scroll });
      gsap.to("[data-fade]", { opacity: 0, y: -40, ease: "none", scrollTrigger: { ...scroll, end: "40% top" } });

      // plate items bob gently, each on its own phase
      el.querySelectorAll<HTMLElement>("[data-bob]").forEach((node, i) => {
        gsap.to(node, { y: -10 - i * 2, duration: 2.6 + i * 0.4, ease: "sine.inOut", yoyo: true, repeat: -1, delay: i * 0.3 });
      });
    });
  });

  return (
    <section ref={ref} className="relative isolate min-h-[100svh] overflow-hidden px-[var(--gutter)] pb-10 pt-28 md:pt-32">
      {/* layer 0: kolam */}
      <div data-kolam className="pointer-events-none absolute -right-[18vw] top-[4vh] -z-10 w-[min(110vw,1100px)] text-brass/60 md:-right-[6vw]">
        <Kolam size={1000} lobes={10} strokeWidth={1.4} />
      </div>

      {/* layer 1: brass plate with sweets */}
      <div data-plate className="pointer-events-none absolute right-[-16vw] top-[13vh] -z-10 aspect-square w-[min(60vw,640px)] md:right-[6vw] md:top-[18vh] md:w-[min(44vw,640px)]">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, #f4dfa8 0%, #d8b26b 28%, #b08d57 55%, #7d5d31 78%, #5d4322 100%)",
            boxShadow: "inset 0 0 0 10px rgba(255,240,200,.25), inset 0 -30px 60px rgba(60,30,10,.35), 0 40px 80px -30px rgba(42,26,18,.55)",
          }}
        />
        <div className="absolute inset-[7%] rounded-full border border-[#fff3d0]/40" />
        <div className="absolute inset-[9%] rounded-full" style={{ background: "repeating-conic-gradient(from 0deg, rgba(255,240,200,.08) 0 4deg, transparent 4deg 8deg)" }} />
        {PLATE.map(([slug, x, y, s, depth, rot]) => (
          <div key={slug} data-depth={depth} className="absolute" style={{ left: `${x}%`, top: `${y}%`, width: `${s}%`, rotate: `${rot}deg` }}>
            <div data-bob>
              <SweetGlyph slug={slug} className="w-full drop-shadow-[0_14px_14px_rgba(42,26,18,.35)]" />
            </div>
          </div>
        ))}
      </div>

      {/* masthead row */}
      <div data-fade className="flex items-start justify-between gap-6">
        <Reveal delay={0.9}>
          <p className="kicker">{t("kicker")}</p>
        </Reveal>
        <Reveal delay={1}>
          <p className="kicker hidden md:block">Vol. I · {new Date().getFullYear()}</p>
        </Reveal>
      </div>

      {/* the wordmark */}
      <h1 className={`display relative mt-[8vh] select-none md:mt-[6vh] ${locale === "ta" ? "text-[clamp(3.6rem,13vw,13rem)] !leading-[1.15]" : "text-[clamp(5.5rem,21vw,21rem)]"}`}>
        <span data-word="1" className="block">
          <SplitReveal text={t("line1")} delay={0.35} />
        </span>
        <span data-word="2" className="display-italic -mt-[0.06em] block pl-[12vw] text-maroon md:pl-[22vw]">
          <SplitReveal text={t("line2")} delay={0.55} />
        </span>
        <span
          className="tamil absolute -left-1 top-[6%] hidden text-base tracking-[0.3em] text-ink-soft [writing-mode:vertical-rl] md:block"
          aria-hidden
        >
          {locale === "ta" ? "IYER MESS" : "ஐய்யர் மெஸ்"}
        </span>
      </h1>

      <div data-fade className="mt-10 grid gap-10 md:mt-6 md:grid-cols-12">
        <div className="md:col-span-5 md:col-start-1">
          <Reveal delay={1.1}>
            <p className="max-w-md text-lg leading-relaxed text-ink-soft md:text-xl">{t("sub")}</p>
          </Reveal>
          <Reveal delay={1.25} className="mt-8 flex flex-wrap items-center gap-3">
            <Magnetic>
              <Link href="/menu" className="btn" data-cursor="Menu">
                {t("cta")}
                <Arrow />
              </Link>
            </Magnetic>
            <Link href="/combos" className="btn btn-ghost">
              {t("cta2")}
            </Link>
          </Reveal>
        </div>

        {/* "in this issue" index, like a magazine contents box */}
        <Reveal delay={1.4} className="md:col-span-4 md:col-start-9 md:self-end">
          <nav aria-label={t("index")} className="rounded-[22px] bg-paper/80 p-5 shadow-[inset_0_0_0_1px_var(--rule)] backdrop-blur-sm">
            <p className="kicker mb-3">{t("index")}</p>
            <ol className="space-y-1.5">
              {[
                { n: "I", label: tn("story.title"), href: "#story", count: null },
                { n: "II", label: tn("almanac.sweets"), href: "#almanac", count: sweets },
                { n: "II", label: tn("almanac.savories"), href: "#almanac", count: savories },
                { n: "III", label: tn("combos.title"), href: "#combos", count: 3 },
              ].map((row) => (
                <li key={row.label}>
                  <a href={row.href} className="group flex items-baseline gap-3">
                    <span className="smallcaps w-7 text-ink-mute">{row.n}</span>
                    <span className="transition-transform duration-300 group-hover:translate-x-1">{row.label}</span>
                    <span className="mx-1 flex-1 border-b border-dotted border-ink/30" />
                    <span className="lnum text-sm text-ink-soft">{row.count ?? "·"}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </Reveal>
      </div>

      <div data-fade className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs uppercase tracking-[0.3em] text-ink-soft md:flex">
        {t("scroll")}
        <span className="relative h-12 w-px overflow-hidden bg-ink/15">
          <span className="absolute inset-x-0 top-0 h-1/2 animate-[scrollcue_1.8s_cubic-bezier(.65,0,.35,1)_infinite] bg-ink" />
        </span>
      </div>
      <style>{`@keyframes scrollcue{0%{transform:translateY(-100%)}100%{transform:translateY(200%)}}`}</style>
    </section>
  );
}

export function Arrow({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}
