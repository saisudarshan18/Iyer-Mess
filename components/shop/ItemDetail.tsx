"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Kolam } from "@/components/art/Kolam";
import { ProductArt } from "@/components/art/SweetGlyph";
import { Magnetic } from "@/components/motion/Magnetic";
import { gsap, useGsap } from "@/components/motion/useGsap";
import { Stepper } from "@/components/site/CartDrawer";
import { useStore } from "@/components/site/StoreProvider";
import { flyToCart, useCart } from "@/lib/cart-store";
import { altNameOf, nameOf } from "@/lib/i18n";
import { formatINR, formatWeight, priceForGrams } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { Arrow } from "@/components/home/Hero";

export function ItemDetail({ product }: { product: Product }) {
  const t = useTranslations();
  const locale = useLocale();
  const { combos, products, stockOf } = useStore();
  const add = useCart((s) => s.add);
  const stock = stockOf(product.id);
  const firstAvailable = product.sell_sizes.find((g) => g <= stock) ?? product.sell_sizes[0];
  const [grams, setGrams] = useState(firstAvailable);
  const [qty, setQty] = useState(1);
  const ref = useRef<HTMLElement>(null);
  const inCombos = combos.filter((c) => c.items.some((i) => i.product_id === product.id));
  const others = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);
  const canAdd = grams * qty <= stock;

  useGsap(ref, (mm, el) => {
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(el.querySelector("[data-spin]"), { rotate: 90, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true } });
      gsap.to(el.querySelector("[data-art]"), { yPercent: 12, rotate: 10, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true } });
    });
  });

  return (
    <section ref={ref} className="px-[var(--gutter)] pb-28 pt-28 md:pt-36">
      <Link href="/menu" className="ink-link text-sm text-ink-soft">
        ← {t("item.back")}
      </Link>
      <div className="mt-8 grid gap-12 md:grid-cols-12">
        <div className="relative aspect-square md:col-span-6">
          <div data-spin className="absolute inset-0 text-brass/50">
            <Kolam size={700} lobes={product.category === "sweet" ? 8 : 12} strokeWidth={1.3} />
          </div>
          <motion.div
            data-art
            className="absolute inset-[16%]"
            initial={{ scale: 0.6, rotate: -30, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 90, damping: 14, delay: 0.3 }}
          >
            <ProductArt slug={product.slug} image={product.image} alt={nameOf(product, locale)} className="h-full w-full drop-shadow-[0_30px_30px_rgba(42,26,18,.35)]" sizes="50vw" />
          </motion.div>
        </div>

        <div className="md:col-span-5 md:col-start-8 md:pt-10">
          <p className="kicker">{product.category === "sweet" ? t("almanac.sweets") : t("almanac.savories")}</p>
          <h1 className="display mt-4 text-[clamp(3.4rem,8vw,7rem)]">{nameOf(product, locale)}</h1>
          <p className={`${locale === "ta" ? "" : "tamil"} mt-2 text-2xl text-maroon`}>{altNameOf(product, locale)}</p>
          {(locale === "ta" ? product.description_ta : product.description_en) && (
            <p className="mt-6 max-w-md text-lg text-ink-soft">{locale === "ta" ? product.description_ta : product.description_en}</p>
          )}
          <p className="mt-6">
            <span className="price text-3xl">{formatINR(product.price_per_kg)}</span>
            <span className="ml-1 text-ink-mute">/ {t("almanac.perKg")}</span>
          </p>

          <fieldset className="mt-10">
            <legend className="label">{t("item.pick")}</legend>
            <div className="mt-2 grid grid-cols-3 gap-3" role="radiogroup">
              {product.sell_sizes.map((g) => {
                const disabled = g > stock;
                const selected = grams === g;
                return (
                  <button
                    key={g}
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => setGrams(g)}
                    className={`relative rounded-2xl px-3 py-4 text-left transition-colors disabled:opacity-35 ${selected ? "text-paper" : "shadow-[inset_0_0_0_1px_var(--rule)] hover:shadow-[inset_0_0_0_1px_var(--ink)]"}`}
                  >
                    {selected && <motion.span layoutId="size-pill" className="absolute inset-0 rounded-2xl bg-ink" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                    <span className="relative block text-lg">{formatWeight(g)}</span>
                    <span className="price relative block text-sm opacity-70">{formatINR(priceForGrams(product.price_per_kg, g))}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div>
              <span className="label">{t("item.qty")}</span>
              <Stepper value={qty} min={1} onChange={setQty} />
            </div>
            <Magnetic className="mt-6">
              <button
                className="btn shine"
                disabled={!canAdd}
                onClick={(e) => {
                  add({ type: "product", id: product.id, grams, qty });
                  flyToCart(e.currentTarget);
                }}
              >
                {canAdd ? `${t("item.addToBox")} · ${formatINR(priceForGrams(product.price_per_kg, grams) * qty)}` : t("almanac.soldOut")}
              </button>
            </Magnetic>
          </div>

          {inCombos.length > 0 && (
            <div className="mt-12 border-t border-rule pt-6">
              <p className="label">{t("item.inCombos")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {inCombos.map((c) => (
                  <Link key={c.id} href="/combos" className="chip">
                    {nameOf(c, locale)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {others.length > 0 && (
        <div className="mt-28">
          <p className="folio">{product.category === "sweet" ? t("almanac.sweets") : t("almanac.savories")}</p>
          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {others.map((p) => (
              <li key={p.id}>
                <Link href={`/item/${p.slug}`} className="group block rounded-[24px] bg-paper-2 p-5">
                  <ProductArt slug={p.slug} image={p.image} alt="" className="mx-auto w-3/4 transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-105" />
                  <span className="mt-3 flex items-center justify-between">
                    <span className="display text-xl">{nameOf(p, locale)}</span>
                    <Arrow className="opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
