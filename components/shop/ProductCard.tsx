"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ProductArt } from "@/components/art/SweetGlyph";
import { MagicCard } from "@/components/motion/MagicCard";
import { useStore } from "@/components/site/StoreProvider";
import { altNameOf, nameOf } from "@/lib/i18n";
import { formatINR } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { WeightPicker } from "./WeightPicker";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

/** A page from the almanac: folio number, illustration, names in both scripts, price per kg. */
export function ProductCard({ product, index, className }: { product: Product; index: number; className?: string }) {
  const t = useTranslations("almanac");
  const locale = useLocale();
  const { stockOf } = useStore();
  const stock = stockOf(product.id);
  const soldOut = stock < Math.min(...product.sell_sizes);
  const low = !soldOut && Number.isFinite(stock) && stock <= product.low_stock_g;
  const name = nameOf(product, locale);
  const alt = altNameOf(product, locale);

  return (
    <MagicCard className={className}>
      <article className="group relative flex h-full flex-col rounded-[28px] bg-paper-2 p-6 shadow-[inset_0_0_0_1px_var(--rule)]">
        <header className="flex items-center justify-between text-xs">
          <span className="smallcaps text-ink-mute">No. {ROMAN[index] ?? index + 1}</span>
          <span className="smallcaps text-ink-mute">{product.category === "sweet" ? t("sweets") : t("savories")}</span>
        </header>

        <Link href={`/item/${product.slug}`} className="relative mx-auto my-2 grid w-full flex-1 place-items-center [transform:translateZ(40px)]" data-cursor="View">
          <span className="absolute aspect-square w-[80%] rounded-full bg-paper-3/70 transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-110" />
          <span aria-hidden className="display-italic pointer-events-none absolute right-0 top-0 text-[5.5rem] leading-none text-ink/[0.06]">
            {index + 1}
          </span>
          <ProductArt
            slug={product.slug}
            image={product.image}
            alt={name}
            className="relative aspect-square w-[92%] max-w-[300px] transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:-translate-y-2 group-hover:rotate-[8deg]"
          />
        </Link>

        <div className="mt-auto">
          <h3 className="display text-[1.9rem] leading-[1]">
            <Link href={`/item/${product.slug}`}>{name}</Link>
          </h3>
          {alt && <p className={`${locale === "ta" ? "" : "tamil"} mt-1 text-sm text-ink-soft`}>{alt}</p>}
          <div className="mt-5 flex items-end justify-between gap-3">
            <p className="leading-none">
              <span className="price text-2xl">{formatINR(product.price_per_kg)}</span>
              <span className="ml-1 text-xs text-ink-mute">/ {t("perKg")}</span>
            </p>
            <WeightPicker product={product} />
          </div>
          {low && <p className="mt-3 text-xs text-kumkum">{t("few")}</p>}
        </div>

        {soldOut && (
          <span className="pointer-events-none absolute right-5 top-16 rotate-[-12deg] rounded-md border-2 border-kumkum px-3 py-1 text-sm uppercase tracking-[0.2em] text-kumkum opacity-90 mix-blend-multiply">
            {t("soldOut")}
          </span>
        )}
      </article>
    </MagicCard>
  );
}
