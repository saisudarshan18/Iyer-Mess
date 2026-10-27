"use client";

import { KolamKnot } from "@/components/art/Kolam";
import { Marquee } from "@/components/motion/Marquee";
import { useStore } from "@/components/site/StoreProvider";

/** Two counter-running rows of names, English over Tamil, leaning with scroll velocity. */
export function MarqueeBand() {
  const { products } = useStore();
  const sweets = products.filter((p) => p.category === "sweet");
  const savories = products.filter((p) => p.category === "savory");

  return (
    <section aria-hidden data-cursor-theme="dark" className="relative -rotate-[1.5deg] scale-[1.03] bg-maroon py-6 text-paper md:py-8">
      <Marquee duration={55} gap="2.2rem">
        {sweets.map((p) => (
          <span key={p.id} className="flex items-center gap-[2.2rem]">
            <span className="display-italic whitespace-nowrap text-[clamp(2.4rem,6vw,5.5rem)] leading-none">{p.name_en}</span>
            <KolamKnot className="shrink-0 text-turmeric" size={34} />
          </span>
        ))}
      </Marquee>
      <Marquee duration={65} reverse gap="2rem" className="mt-3">
        {savories.map((p) => (
          <span key={p.id} className="flex items-center gap-8">
            <span className="tamil whitespace-nowrap text-[clamp(1.4rem,3vw,2.6rem)] leading-none text-turmeric-soft">{p.name_ta}</span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-paper/50" />
          </span>
        ))}
      </Marquee>
    </section>
  );
}
