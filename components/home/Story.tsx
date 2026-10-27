"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Kolam, KolamKnot } from "@/components/art/Kolam";
import { TextReveal } from "@/components/motion/TextReveal";
import { Reveal } from "@/components/motion/Reveal";
import { gsap, useGsap } from "@/components/motion/useGsap";
import { SINCE, STORY_IMAGES } from "@/lib/content";

export function Story() {
  const t = useTranslations("story");
  const ref = useRef<HTMLElement>(null);

  useGsap(ref, (mm, el) => {
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      el.querySelectorAll<HTMLElement>("[data-photo]").forEach((node, i) => {
        gsap.fromTo(
          node,
          { yPercent: 18 + i * 14, rotate: i % 2 ? 4 : -3, filter: "sepia(1) saturate(.6) contrast(1.05)" },
          {
            yPercent: -10 - i * 10,
            rotate: i % 2 ? -2 : 2,
            filter: "sepia(0) saturate(1) contrast(1)",
            ease: "none",
            scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      });
      const draw = el.querySelectorAll<SVGGeometryElement>("[data-story-kolam] [data-draw]");
      draw.forEach((p) => {
        const len = p.getTotalLength();
        gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, {
          strokeDashoffset: 0,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top 70%", end: "bottom 60%", scrub: true },
        });
      });
    });
  });

  return (
    <section id="story" ref={ref} className="relative px-[var(--gutter)] py-28 md:py-40">
      <div className="grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="md:sticky md:top-28">
            <p className="folio">
              {t("chapter")}
              {SINCE && <span className="lnum">· {SINCE}</span>}
            </p>
            <h2 className="display mt-6 text-[clamp(3.2rem,7vw,6.5rem)]">{t("title")}</h2>
            <div data-story-kolam className="mt-10 hidden w-56 text-maroon/70 md:block">
              <Kolam size={300} lobes={6} strokeWidth={1.6} />
            </div>
          </div>
        </div>
        <div className="md:col-span-8 md:col-start-5">
          <TextReveal text={t("body")} className="text-[clamp(1.6rem,3.2vw,3rem)] leading-[1.22] tracking-[-0.015em]" />

          {STORY_IMAGES.length > 0 && (
            <div className="relative mt-20 grid grid-cols-6 gap-4">
              {STORY_IMAGES.slice(0, 3).map((img, i) => (
                <div
                  key={img.src}
                  data-photo
                  className={`overflow-hidden rounded-[20px] bg-paper-2 shadow-[0_30px_60px_-30px_rgba(42,26,18,.6)] ${
                    ["col-span-4", "col-span-3 col-start-4 -mt-24", "col-span-3 -mt-10"][i]
                  }`}
                >
                  <Image src={img.src} alt={img.alt} width={1000} height={1250} className="h-full w-full object-cover" sizes="(min-width: 768px) 40vw, 70vw" />
                </div>
              ))}
            </div>
          )}

          <Reveal className="mt-20 flex items-start gap-5 border-t border-rule pt-8">
            <KolamKnot className="mt-2 shrink-0 text-kumkum" size={30} />
            <blockquote className="display-italic text-[clamp(1.6rem,2.8vw,2.4rem)] leading-tight text-maroon">“{t("quote")}”</blockquote>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
