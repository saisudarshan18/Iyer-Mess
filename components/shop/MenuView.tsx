"use client";

import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ProductArt } from "@/components/art/SweetGlyph";
import { KolamKnot } from "@/components/art/Kolam";
import { useStore } from "@/components/site/StoreProvider";
import { altNameOf, nameOf } from "@/lib/i18n";
import { formatINR } from "@/lib/pricing";
import type { Category } from "@/lib/types";
import { OfferShowcase } from "./OfferShowcase";
import { ProductCard } from "./ProductCard";
import { WeightPicker } from "./WeightPicker";

type Filter = "all" | Category;

export function MenuView() {
  const t = useTranslations();
  const locale = useLocale();
  const { products, stockOf } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [hover, setHover] = useState<string | null>(null);

  const shown = products.filter((p) => filter === "all" || p.category === filter);
  const groups: Category[] = filter === "all" ? ["sweet", "savory"] : [filter];
  const hovered = products.find((p) => p.id === hover);

  return (
    <section className="px-[var(--gutter)] pb-28 pt-32 md:pt-40">
      <div className="grid gap-8 md:grid-cols-12">
        <div className="md:col-span-7">
          <h1 className="display text-[clamp(4rem,11vw,10rem)]">{t("menu.title")}</h1>
          <p className="mt-4 max-w-md text-lg text-ink-soft">{t("menu.sub")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 md:col-span-5 md:justify-end">
          <LayoutGroup id="filters">
            {(["all", "sweet", "savory"] as Filter[]).map((f) => (
              <button key={f} className="chip relative" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === "all" ? t("menu.all") : f === "sweet" ? t("almanac.sweets") : t("almanac.savories")}
                <span className="lnum text-xs opacity-60">{products.filter((p) => f === "all" || p.category === f).length}</span>
              </button>
            ))}
          </LayoutGroup>
          <span className="mx-2 h-6 w-px bg-rule" />
          {(["list", "grid"] as const).map((v) => (
            <button key={v} className="chip" aria-pressed={view === v} onClick={() => setView(v)}>
              {t(`menu.${v}`)}
            </button>
          ))}
        </div>
      </div>

      <OfferShowcase className="-mx-[var(--gutter)] mt-12" />

      {view === "list" ? (
        <div className="relative mt-16 grid gap-16 md:grid-cols-12">
          <div className="md:col-span-8">
            {groups.map((g) => (
              <div key={g} className="mb-16">
                <p className="folio mb-4">{g === "sweet" ? t("almanac.sweets") : t("almanac.savories")}</p>
                <ul>
                  <AnimatePresence initial={false}>
                    {shown
                      .filter((p) => p.category === g)
                      .map((p, i) => {
                        const soldOut = stockOf(p.id) < Math.min(...p.sell_sizes);
                        return (
                          <motion.li
                            key={p.id}
                            layout
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
                            exit={{ opacity: 0 }}
                            onMouseEnter={() => setHover(p.id)}
                            onMouseLeave={() => setHover(null)}
                            className="group flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-rule py-5 sm:flex-nowrap"
                          >
                            <ProductArt slug={p.slug} image={p.image} alt="" className="h-14 w-14 shrink-0 transition-transform duration-500 group-hover:rotate-12 md:hidden" />
                            <Link href={`/item/${p.slug}`} className="min-w-0 flex-1">
                              <span className={`display block text-[clamp(1.6rem,3vw,2.5rem)] leading-tight transition-[transform,color] duration-500 group-hover:translate-x-2 ${soldOut ? "text-ink/35 line-through decoration-1" : ""}`}>
                                {nameOf(p, locale)}
                              </span>
                              <span className={`${locale === "ta" ? "" : "tamil"} text-sm text-ink-soft`}>{altNameOf(p, locale)}</span>
                            </Link>
                            <span className="hidden flex-1 translate-y-2 border-b border-dotted border-ink/25 sm:block" />
                            <span className="price shrink-0 text-xl">
                              {formatINR(p.price_per_kg)}
                              <span className="ml-1 text-xs text-ink-mute">/ kg</span>
                            </span>
                            <WeightPicker product={p} />
                          </motion.li>
                        );
                      })}
                  </AnimatePresence>
                </ul>
              </div>
            ))}
          </div>

          {/* the hovered item floats in a sticky frame beside the list */}
          <div className="hidden md:col-span-4 md:block">
            <div className="sticky top-32 grid aspect-[4/5] place-items-center overflow-hidden rounded-[32px] bg-paper-2">
              <div className="absolute inset-0 grid place-items-center text-brass/30">
                <KolamKnot size={420} />
              </div>
              <AnimatePresence mode="popLayout">
                {hovered ? (
                  <motion.div
                    key={hovered.id}
                    initial={{ opacity: 0, scale: 0.7, rotate: -20 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.8, rotate: 20 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="relative w-[70%] text-center"
                  >
                    <ProductArt slug={hovered.slug} image={hovered.image} alt="" className="w-full drop-shadow-[0_24px_24px_rgba(42,26,18,.3)]" />
                    <p className="display mt-4 text-3xl">{nameOf(hovered, locale)}</p>
                  </motion.div>
                ) : (
                  <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="display-italic relative px-10 text-center text-2xl text-ink-soft">
                    {t("almanac.choose")}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      ) : (
        <motion.div layout className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatePresence>
            {shown.map((p, i) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={`h-[460px] ${i % 4 === 1 || i % 4 === 3 ? "lg:translate-y-12" : ""}`}
              >
                <ProductCard product={p} index={products.indexOf(p)} className="h-full" />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </section>
  );
}
