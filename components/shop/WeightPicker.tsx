"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { flyToCart, useCart } from "@/lib/cart-store";
import { formatINR, formatWeight, priceForGrams } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { useStore } from "@/components/site/StoreProvider";

/** "Add +" grows into ¼ · ½ · 1 kg chips; picking one throws a token into the cart. */
export function WeightPicker({ product, tone = "ink" }: { product: Product; tone?: "ink" | "paper" }) {
  const t = useTranslations("almanac");
  const add = useCart((s) => s.add);
  const { stockOf } = useStore();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const stock = stockOf(product.id);
  const soldOut = stock < Math.min(...product.sell_sizes);

  const pick = (grams: number, el: HTMLElement) => {
    add({ type: "product", id: product.id, grams });
    flyToCart(el);
    setOpen(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  const solid = tone === "ink" ? "bg-ink text-paper" : "bg-paper text-ink";

  return (
    <div ref={wrap} className="relative" onMouseLeave={() => setOpen(false)}>
      <AnimatePresence mode="popLayout" initial={false}>
        {open ? (
          <motion.div
            key="sizes"
            layoutId={`wp-${product.id}`}
            className={`flex items-center gap-1 rounded-full p-1 ${solid}`}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            role="group"
            aria-label={t("choose")}
          >
            {product.sell_sizes.map((g, i) => (
              <motion.button
                key={g}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i }}
                disabled={stock < g}
                onClick={(e) => pick(g, e.currentTarget)}
                className="flex min-h-10 flex-col items-center justify-center rounded-full px-3 leading-none transition-colors hover:bg-turmeric hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent"
                title={formatINR(priceForGrams(product.price_per_kg, g))}
              >
                <span className="text-[13px]">{formatWeight(g)}</span>
                <span className="price mt-0.5 text-[10px] opacity-70">{formatINR(priceForGrams(product.price_per_kg, g))}</span>
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <motion.button
            key="add"
            layoutId={`wp-${product.id}`}
            disabled={soldOut}
            onClick={() => setOpen(true)}
            className={`flex h-12 items-center gap-2 rounded-full px-5 text-sm disabled:opacity-40 ${solid}`}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            aria-haspopup="true"
          >
            {added ? (
              <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
                {t("added")}
              </motion.span>
            ) : soldOut ? (
              t("soldOut")
            ) : (
              <>
                {t("add")}
                <span className="text-base leading-none">+</span>
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
