"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { Kolam } from "@/components/art/Kolam";
import { ProductArt } from "@/components/art/SweetGlyph";
import { NumberTicker } from "@/components/motion/NumberTicker";
import { gsap, useGsap } from "@/components/motion/useGsap";
import { useStore } from "@/components/site/StoreProvider";
import { flyToCart, useCart } from "@/lib/cart-store";
import { nameOf } from "@/lib/i18n";
import { comboComponentValue, comboTotal, comboWeight, formatINR, formatWeight } from "@/lib/pricing";
import type { Combo } from "@/lib/types";

/**
 * The box opens as it scrolls into view: the lid lifts and tips away and the
 * sweets rise out in a fan, while the receipt beside it lists what's inside.
 */
export function ComboFeature({ combo, flip = false }: { combo: Combo; flip?: boolean }) {
  const t = useTranslations("combos");
  const locale = useLocale();
  const { products, combosAvailable } = useStore();
  const add = useCart((s) => s.add);
  const ref = useRef<HTMLDivElement>(null);
  const parts = comboComponentValue(combo, products);
  const available = combosAvailable(combo.id);
  const soldOut = available < 1;
  const n = parts.length;

  useGsap(ref, (mm, el) => {
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top 75%", end: "center 45%", scrub: 0.8 },
      });
      // the lid lifts, then tips away to rest beside the box
      tl.to(el.querySelector("[data-lid]"), { yPercent: -260, xPercent: flip ? 62 : -62, rotate: flip ? 64 : -64, ease: "power2.out" }, 0);
      // fan the pieces across an arc above the box, sized to the box so it never overflows
      const box = el.querySelector<HTMLElement>("[data-box]")!.offsetWidth;
      el.querySelectorAll<HTMLElement>("[data-piece]").forEach((piece, i) => {
        const angle = ((i / Math.max(1, n - 1)) - 0.5) * Math.PI * 0.85;
        const radius = box * (0.36 + (i % 2) * 0.1);
        tl.fromTo(
          piece,
          { x: 0, y: 70, rotate: 0, scale: 0.6, opacity: 0 },
          { x: Math.sin(angle) * radius * 1.15, y: -Math.cos(angle) * radius - box * 0.06, rotate: angle * 30, scale: 1, opacity: 1, ease: "back.out(1.4)" },
          0.08 + i * 0.03,
        );
      });
      tl.from(el.querySelectorAll("[data-receipt-row]"), { opacity: 0, x: flip ? -20 : 20, stagger: 0.04 }, 0.1);
    });
  });

  return (
    <div ref={ref} className="grid items-center gap-10 py-16 md:grid-cols-12 md:gap-6 md:py-24">
      {/* the box */}
      <div data-box className={`relative mx-auto aspect-[1/1] w-full max-w-[520px] md:col-span-6 ${flip ? "md:order-2 md:col-start-7" : ""}`}>
        {/* back wall, seen above the front face once the lid is off */}
        <div className="absolute inset-x-[13%] top-[40%] h-[10%] rounded-t-[8px] bg-maroon-deep" />
        <div className="absolute inset-x-[12%] bottom-[10%] top-[44%]">
          {/* pieces start inside the box (behind its front face) */}
          <div className="absolute inset-x-0 top-[10%] flex justify-center">
            {parts.map(({ product }, i) =>
              product ? (
                <div key={product.id} data-piece className="absolute w-[30%]" style={{ zIndex: 2 }}>
                  <ProductArt slug={product.slug} image={product.image} alt={nameOf(product, locale)} className="w-full drop-shadow-[0_10px_10px_rgba(42,26,18,.3)]" />
                </div>
              ) : null,
            )}
          </div>
          {/* front face */}
          <div data-cursor-theme="dark" className="absolute inset-0 z-[3] overflow-hidden rounded-b-[18px] rounded-t-[6px] bg-maroon shadow-[0_40px_60px_-30px_rgba(42,26,18,.7)]">
            <div className="absolute inset-0 text-turmeric/35">
              <Kolam size={400} lobes={8} strokeWidth={2} className="absolute -left-[10%] top-[-30%] w-[120%]" />
            </div>
            <div className="absolute inset-x-0 top-0 h-3 bg-maroon-deep" />
            <p className="display absolute bottom-[14%] left-0 right-0 text-center text-[clamp(2.4rem,6vw,4.4rem)] text-paper">
              {combo.slug.replace("combo-", "")}
            </p>
            <p className="tamil absolute bottom-[6%] left-0 right-0 text-center text-xs tracking-[0.3em] text-turmeric-soft">ஐய்யர் மெஸ்</p>
          </div>
        </div>
        {/* lid */}
        <div data-lid className="absolute inset-x-[9%] top-[38%] z-[4] h-[10%] rounded-[10px] bg-maroon-deep shadow-[0_10px_20px_-8px_rgba(0,0,0,.5)]">
          <div className="absolute inset-x-[30%] top-[38%] h-[24%] rounded-full bg-turmeric/70" />
        </div>
      </div>

      {/* the receipt */}
      <div className={`md:col-span-5 ${flip ? "md:order-1 md:col-start-1" : "md:col-start-8"}`}>
        <p className="kicker">
          {t("items", { count: n })} · {t("weight", { weight: formatWeight(comboWeight(combo)) })}
        </p>
        <h3 className="display mt-3 text-[clamp(3rem,6vw,5.5rem)]">{nameOf(combo, locale)}</h3>

        <div className="relative mt-8 rounded-[6px] bg-[#fbf6ec] px-6 pb-6 pt-5 shadow-[0_24px_50px_-28px_rgba(42,26,18,.5)] [mask:radial-gradient(circle_at_50%_100%,transparent_6px,#000_6.5px)_0_100%/16px_14px_repeat-x,linear-gradient(#000_0_0)_0_0/100%_calc(100%-13px)_no-repeat]">
          <p className="smallcaps mb-3 text-ink-mute">{t("inside")}</p>
          <ol className="space-y-1.5 text-[0.98rem]">
            {parts.map(({ product, grams, amount }, i) => (
              <li key={i} data-receipt-row className="flex items-baseline gap-2">
                <span className="lnum w-6 text-xs text-ink-mute">{String(i + 1).padStart(2, "0")}</span>
                <span>{product ? nameOf(product, locale) : "—"}</span>
                <span className="text-xs text-ink-mute">{formatWeight(grams)}</span>
                <span className="mx-1 flex-1 translate-y-[-3px] border-b border-dotted border-ink/30" />
                <span className="price">{formatINR(amount)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 space-y-1 border-t border-dashed border-ink/25 pt-3 text-sm">
            <div data-receipt-row className="flex justify-between text-ink-soft">
              <span>{t("subtotal")}</span>
              <span className="price">{formatINR(combo.price)}</span>
            </div>
            <div data-receipt-row className="flex justify-between text-ink-soft">
              <span>{t("packing")}</span>
              <span className="price">{formatINR(combo.packing_charge)}</span>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between border-t border-ink/60 pt-3">
            <span className="smallcaps">{t("total")}</span>
            <NumberTicker value={comboTotal(combo)} prefix="₹" className="display text-5xl" />
          </div>
          <p className="mt-1 text-right text-xs text-ink-mute">{t("excl")}</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            className="btn btn-turmeric shine"
            disabled={soldOut}
            onClick={(e) => {
              add({ type: "combo", id: combo.id });
              flyToCart(e.currentTarget, "#7a1f1f");
            }}
          >
            {soldOut ? t("soldOut") : `${t("add")} · ${formatINR(comboTotal(combo))}`}
          </button>
          {Number.isFinite(available) && !soldOut && <span className="text-sm text-ink-soft">{t("boxesLeft", { count: available })}</span>}
        </div>
      </div>
    </div>
  );
}
