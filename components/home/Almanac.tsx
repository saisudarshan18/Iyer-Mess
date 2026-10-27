"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { Kolam } from "@/components/art/Kolam";
import { ProductArt } from "@/components/art/SweetGlyph";
import { gsap, useGsap } from "@/components/motion/useGsap";
import { ProductCard } from "@/components/shop/ProductCard";
import { WeightPicker } from "@/components/shop/WeightPicker";
import { useStore } from "@/components/site/StoreProvider";
import { altNameOf, nameOf } from "@/lib/i18n";
import { formatINR } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { Arrow } from "./Hero";

/**
 * The menu as two plain grids (sweets, then savories) that scroll with the page; cards rise in
 * as they enter. Phones get compact rows instead, so twenty items stay a short scroll.
 */
export function Almanac() {
  const t = useTranslations("almanac");
  const locale = useLocale();
  const { products, stockOf } = useStore();
  const ref = useRef<HTMLElement>(null);
  const sweets = products.filter((p) => p.category === "sweet");
  const savories = products.filter((p) => p.category === "savory");

  useGsap(ref, (mm, el) => {
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.utils.toArray<HTMLElement>("[data-page]", el).forEach((card) => {
        gsap.from(card, { y: 40, opacity: 0, rotate: 2, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: card, start: "top 92%", once: true } });
      });
      gsap.to(el.querySelector("[data-almanac-kolam]"), {
        rotate: 180,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      });
    });
  });

  const grid = (list: Product[], offset: number) => (
    <>
      <div className="hidden gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((p, i) => (
          <div key={p.id} data-page className="h-full">
            <ProductCard product={p} index={offset + i} className="h-full" />
          </div>
        ))}
      </div>
      <ul className="divide-y divide-rule border-y border-rule sm:hidden">
        {list.map((p) => {
          const soldOut = stockOf(p.id) < Math.min(...p.sell_sizes);
          return (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <Link href={`/item/${p.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
                <ProductArt slug={p.slug} image={p.image} alt="" className="h-14 w-14 shrink-0" />
                <span className="min-w-0">
                  <span className={`display block truncate text-[1.45rem] leading-tight ${soldOut ? "text-ink/35 line-through decoration-1" : ""}`}>{nameOf(p, locale)}</span>
                  <span className={`${locale === "ta" ? "" : "tamil"} block truncate text-xs text-ink-soft`}>{altNameOf(p, locale)}</span>
                  <span className="block whitespace-nowrap text-sm">
                    <span className="price">{formatINR(p.price_per_kg)}</span>
                    <span className="text-xs text-ink-mute"> / {t("perKg")}</span>
                  </span>
                </span>
              </Link>
              <WeightPicker product={p} />
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <section id="almanac" ref={ref} className="relative overflow-hidden bg-paper px-[var(--gutter)] pb-24 pt-24 md:pt-28">
      <div data-almanac-kolam className="pointer-events-none absolute -bottom-[30vh] left-[30vw] w-[90vh] text-turmeric/25" aria-hidden>
        <Kolam size={800} lobes={16} strokeWidth={1.2} dots={false} />
      </div>

      <div className="relative">
        <p className="folio w-full max-w-xs">{t("chapter")}</p>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <h2 className="display text-[clamp(3.4rem,8vw,8.5rem)]">
            {t("title").split(" ").map((w, i) => (
              <span key={i} className={`${i ? "display-italic pl-[0.3em] text-maroon" : ""}`}>
                {w}
              </span>
            ))}
          </h2>
          <Link href="/menu" className="btn btn-ghost">
            {t("viewAll")} <Arrow />
          </Link>
        </div>

        <h3 className="display-italic mb-6 mt-14 text-[clamp(2.2rem,4vw,3.4rem)] text-maroon">{t("sweets")}</h3>
        {grid(sweets, 0)}

        <h3 className="display-italic mb-6 mt-16 text-[clamp(2.2rem,4vw,3.4rem)] text-maroon">{t("savories")}</h3>
        {grid(savories, sweets.length)}

        <div className="mt-16 flex justify-center">
          <Link href="/menu" className="group flex flex-col items-center gap-4 text-center" data-cursor="Menu">
            <span className="grid h-28 w-28 place-items-center rounded-full bg-ink text-paper transition-transform duration-500 group-hover:scale-110 group-hover:bg-kumkum">
              <Arrow className="h-7 w-7" />
            </span>
            <span className="display text-2xl">{t("viewAll")}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
