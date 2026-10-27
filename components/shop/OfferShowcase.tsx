"use client";

import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { Kolam } from "@/components/art/Kolam";
import { ProductArt } from "@/components/art/SweetGlyph";
import { useStore } from "@/components/site/StoreProvider";
import { flyToCart, useCart } from "@/lib/cart-store";
import { nameOf } from "@/lib/i18n";
import { comboComponentValue, comboTotal, comboWeight, formatINR, formatWeight } from "@/lib/pricing";
import type { Combo } from "@/lib/types";

/** Combos marked as offers (offer_label), shown as a bold band: what's inside, the usual price, the offer price. */
export function OfferShowcase({ className = "" }: { className?: string }) {
  const { combos } = useStore();
  const offers = combos.filter((c) => c.offer_label);
  if (!offers.length) return null;
  return (
    <section id="offer" className={`px-[var(--gutter)] ${className}`}>
      <div className="grid gap-6">
        {offers.map((c) => (
          <Offer key={c.id} combo={c} />
        ))}
      </div>
    </section>
  );
}

function Offer({ combo }: { combo: Combo }) {
  const t = useTranslations("offer");
  const locale = useLocale();
  const { products, combosAvailable } = useStore();
  const add = useCart((s) => s.add);
  const parts = comboComponentValue(combo, products);
  const worth = parts.reduce((s, p) => s + p.amount, 0) + combo.packing_charge;
  const price = comboTotal(combo);
  const save = Math.max(0, Math.round(worth - price));
  const soldOut = combosAvailable(combo.id) < 1;
  const label = locale === "ta" && combo.offer_label_ta ? combo.offer_label_ta : combo.offer_label;
  const sweets = parts.filter((p) => p.product?.category === "sweet");
  const savories = parts.filter((p) => p.product?.category === "savory");

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      data-cursor-theme="dark"
      className="relative overflow-hidden rounded-[32px] bg-maroon text-paper"
    >
      <div className="pointer-events-none absolute -right-[15%] -top-[40%] w-[70%] text-turmeric/20" aria-hidden>
        <Kolam size={600} lobes={12} strokeWidth={1.4} dots={false} />
      </div>

      <div className="relative grid gap-8 p-6 sm:p-10 md:grid-cols-12 md:items-center md:gap-10 md:p-14">
        <div className="md:col-span-7">
          <p className="inline-flex items-center gap-2 rounded-full bg-turmeric px-3 py-1 text-sm font-medium text-ink">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-kumkum" aria-hidden />
            {label}
          </p>
          <h2 className="display mt-5 text-[clamp(2.4rem,6vw,5rem)] leading-[0.95]">{nameOf(combo, locale)}</h2>
          <p className="mt-4 max-w-lg text-paper/80">{t("sub", { weight: formatWeight(comboWeight(combo)) })}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              [t("sweets", { weight: formatWeight(sweets.reduce((s, p) => s + p.grams, 0)) }), sweets],
              [t("savory", { weight: formatWeight(savories.reduce((s, p) => s + p.grams, 0)) }), savories],
            ].map(([title, list]) =>
              (list as typeof parts).length ? (
                <div key={title as string} className="rounded-2xl bg-paper/10 p-4">
                  <p className="smallcaps text-turmeric-soft">{title as string}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {(list as typeof parts).map(({ product, grams }) => (
                      <li key={product!.id} className="flex items-center gap-2">
                        <ProductArt slug={product!.slug} image={product!.image} alt="" className="h-7 w-7 shrink-0" />
                        <span className="flex-1">{nameOf(product!, locale)}</span>
                        <span className="lnum text-paper/60">{formatWeight(grams)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        </div>

        <div className="md:col-span-5 md:pl-6">
          <div className="rounded-[24px] bg-paper p-6 text-ink sm:p-8">
            {save > 0 && (
              <p className="flex items-baseline justify-between text-sm text-ink-soft">
                <span>{t("usual")}</span>
                <span className="price line-through decoration-kumkum decoration-2">{formatINR(Math.round(worth))}</span>
              </p>
            )}
            <p className="mt-2 flex items-end justify-between gap-3">
              <span className="smallcaps">{t("price")}</span>
              <span className="display price text-[clamp(3.5rem,8vw,5.5rem)] leading-none text-maroon">{formatINR(price)}</span>
            </p>
            {save > 0 && <p className="mt-3 rounded-full bg-leaf/10 px-3 py-1.5 text-center text-sm font-medium text-leaf">{t("save", { amount: formatINR(save) })}</p>}
            <button
              className="btn btn-turmeric shine mt-6 w-full"
              disabled={soldOut}
              onClick={(e) => {
                add({ type: "combo", id: combo.id });
                flyToCart(e.currentTarget, "#7a1f1f");
              }}
            >
              {soldOut ? t("soldOut") : t("add", { amount: formatINR(price) })}
            </button>
            <p className="mt-3 text-center text-xs text-ink-mute">{t("note")}</p>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
