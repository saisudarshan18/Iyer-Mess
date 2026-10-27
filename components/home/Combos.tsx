"use client";

import { useTranslations } from "next-intl";
import { Reveal } from "@/components/motion/Reveal";
import { ComboFeature } from "@/components/shop/ComboFeature";
import { useStore } from "@/components/site/StoreProvider";

export function Combos() {
  const t = useTranslations("combos");
  // offers are showcased on their own (OfferShowcase)
  const combos = useStore().combos.filter((c) => !c.offer_label);
  return (
    <section id="combos" className="relative bg-paper-2 px-[var(--gutter)] py-28 md:py-36">
      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-6">
          <p className="folio">{t("chapter")}</p>
          <h2 className="display mt-6 text-[clamp(3.2rem,7vw,6.5rem)]">{t("title")}</h2>
        </div>
        <Reveal className="md:col-span-4 md:col-start-9 md:self-end">
          <p className="text-lg text-ink-soft">{t("sub")}</p>
        </Reveal>
      </div>
      <div className="mt-8 divide-y divide-rule">
        {combos.map((c, i) => (
          <ComboFeature key={c.id} combo={c} flip={i % 2 === 1} />
        ))}
      </div>
    </section>
  );
}
