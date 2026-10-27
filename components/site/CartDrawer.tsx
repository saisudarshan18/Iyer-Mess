"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useCart } from "@/lib/cart-store";
import { nameOf } from "@/lib/i18n";
import { cartTotals, formatINR, formatWeight } from "@/lib/pricing";
import { ProductArt } from "@/components/art/SweetGlyph";
import { useLenis } from "@/components/motion/SmoothScroll";
import { useStore } from "./StoreProvider";

export function CartDrawer() {
  const t = useTranslations("cart");
  const tc = useTranslations("closed");
  const locale = useLocale();
  const { products, combos, settings } = useStore();
  const { lines, open, setOpen, setQty, remove } = useCart();
  const lenis = useLenis();
  const panel = useRef<HTMLDivElement>(null);
  const totals = cartTotals(lines, products, combos);

  useEffect(() => {
    if (open) {
      lenis?.stop();
      panel.current?.focus();
    } else lenis?.start();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, lenis, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]">
          <motion.button
            aria-label={t("close")}
            className="absolute inset-0 bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={t("title")}
            tabIndex={-1}
            data-lenis-prevent
            className="absolute right-0 top-0 flex h-full w-full max-w-[460px] flex-col bg-paper outline-none"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between border-b border-rule px-6 py-5">
              <h2 className="display text-3xl">{t("title")}</h2>
              <button onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-paper-2" aria-label={t("close")}>
                <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M5 5l14 14M19 5L5 19" />
                </svg>
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
                <p className="display-italic text-2xl text-ink-soft">{t("empty")}</p>
                <Link href="/menu" className="btn" onClick={() => setOpen(false)}>
                  {t("emptyCta")}
                </Link>
              </div>
            ) : (
              <>
                <ul className="flex-1 divide-y divide-rule overflow-y-auto px-6">
                  <AnimatePresence initial={false}>
                    {totals.lines.map(({ line, amount, packing }) => {
                      const item = line.type === "product" ? products.find((p) => p.id === line.id) : combos.find((c) => c.id === line.id);
                      if (!item) return null;
                      return (
                        <motion.li
                          key={line.key}
                          layout
                          initial={{ opacity: 0, x: 30 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -30, height: 0, paddingTop: 0, paddingBottom: 0 }}
                          className="flex gap-4 overflow-hidden py-5"
                        >
                          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-paper-2">
                            {line.type === "product" ? (
                              <ProductArt slug={item.slug} image={item.image} alt="" className="h-16 w-16" />
                            ) : (
                              <span className="display text-3xl text-maroon">{item.slug.replace("combo-", "")}</span>
                            )}
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <div className="flex justify-between gap-3">
                              <p className="truncate font-medium">{nameOf(item, locale)}</p>
                              <p className="price shrink-0">{formatINR(amount + packing)}</p>
                            </div>
                            <p className="text-sm text-ink-soft">
                              {line.type === "product" ? formatWeight(line.grams) : `${t("packing")} ${formatINR(packing)}`}
                            </p>
                            <div className="mt-auto flex items-center justify-between pt-2">
                              <Stepper value={line.qty} onChange={(q) => setQty(line.key, q)} />
                              <button onClick={() => remove(line.key)} className="ink-link text-sm text-ink-soft">
                                {t("remove")}
                              </button>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
                <div className="space-y-2 border-t border-rule bg-paper-2/60 px-6 py-5">
                  <Row label={t("subtotal")} value={formatINR(totals.subtotal)} />
                  {totals.packing > 0 && <Row label={t("packing")} value={formatINR(totals.packing)} />}
                  <p className="pt-1 text-sm text-ink-soft">{t("note")}</p>
                  {settings.orders_open ? (
                    <Link href="/checkout" onClick={() => setOpen(false)} className="btn mt-3 w-full">
                      {t("checkout")} · {formatINR(totals.subtotal + totals.packing)}
                    </Link>
                  ) : (
                    <p className="mt-3 rounded-xl bg-maroon px-4 py-3 text-center text-paper">{tc("checkout")}</p>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="price">{value}</span>
    </div>
  );
}

export function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="inline-flex items-center rounded-full shadow-[inset_0_0_0_1px_var(--rule)]">
      <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper-3" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Decrease">
        −
      </button>
      <motion.span key={value} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="lnum w-7 text-center text-sm">
        {value}
      </motion.span>
      <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper-3" onClick={() => onChange(value + 1)} aria-label="Increase">
        +
      </button>
    </div>
  );
}
