"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { SweetGlyph } from "@/components/art/SweetGlyph";
import { Kolam } from "@/components/art/Kolam";
import { ScrollTrigger, useGsap } from "@/components/motion/useGsap";
import { useStore } from "@/components/site/StoreProvider";

type Media = { type: "image" | "video"; url: string };

/** A step's photo or looping video; until one is uploaded, a framed placeholder with the step's art. */
function StepMedia({ media, art, n, label }: { media?: Media; art: string; n: number; label: string }) {
  if (media?.type === "video") {
    return <video src={media.url} className="h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" aria-label={label} />;
  }
  if (media?.type === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media.url} alt={label} className="h-full w-full object-cover" loading="lazy" />;
  }
  return (
    <div className="relative grid h-full w-full place-items-center bg-paper-2">
      <div className="absolute inset-3 rounded-[18px] border border-dashed border-ink/20" />
      <div className="absolute inset-0 text-brass/25">
        <Kolam size={400} lobes={6} strokeWidth={1.2} dots={false} />
      </div>
      <SweetGlyph slug={art} className="relative w-[38%] drop-shadow-[0_14px_14px_rgba(42,26,18,.25)]" />
      <span className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-paper/90 px-3 py-1 text-xs text-ink-soft">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M4 7h3l2-2h6l2 2h3v12H4zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
        </svg>
        {label}
      </span>
      <span className="display absolute right-4 top-3 text-4xl text-ink/10">{String(n).padStart(2, "0")}</span>
    </div>
  );
}

const STAGES = [
  { key: "1", art: ["ravaladdu", "laddu"] },
  { key: "2", art: ["mullu-murukku", "thenkuzhal"] },
  { key: "3", art: ["jangiri", "badhusha"] },
  { key: "4", art: ["ghee-mysore-pak", "kai-murukku"] },
];

/** Sticky stage on the left crossfades as each step on the right takes the centre of the screen. */
export function Process() {
  const t = useTranslations("process");
  const tp = useTranslations("process2");
  const { settings } = useStore();
  const media = (settings.process_media ?? {}) as Record<string, Media | undefined>;
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useGsap(ref, (_mm, el) => {
    el.querySelectorAll<HTMLElement>("[data-step]").forEach((step, i) => {
      ScrollTrigger.create({
        trigger: step,
        start: "top 55%",
        end: "bottom 55%",
        onToggle: (self) => self.isActive && setActive(i),
      });
    });
  });

  return (
    <section ref={ref} className="relative px-[var(--gutter)] py-28 md:py-36">
      <p className="folio">{t("chapter")}</p>
      <h2 className="display mt-6 max-w-4xl text-[clamp(3rem,6.5vw,6rem)]">{t("title")}</h2>

      <div className="mt-16 grid gap-10 md:grid-cols-12">
        <div className="hidden md:col-span-6 md:block">
          <div data-cursor-theme="dark" className="sticky top-[14vh] aspect-square w-full max-w-[560px] overflow-hidden rounded-full bg-leaf">
            <div className="absolute inset-0 text-paper/15">
              <Kolam size={600} lobes={8} strokeWidth={1.4} />
            </div>
            <AnimatePresence mode="popLayout">
              <motion.div
                key={active}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 0.85, rotate: -12 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 1.1, rotate: 10 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                {media[STAGES[active].key] ? (
                  <div className="absolute inset-0">
                    <StepMedia media={media[STAGES[active].key]} art={STAGES[active].art[0]} n={active + 1} label={t(`s${STAGES[active].key}t`)} />
                  </div>
                ) : (
                  <SweetGlyph slug={STAGES[active].art[0]} className="absolute left-[14%] top-[18%] w-[52%] drop-shadow-[0_20px_20px_rgba(0,0,0,.35)]" />
                )}
                {!media[STAGES[active].key] && (
                  <SweetGlyph slug={STAGES[active].art[1]} className="absolute bottom-[12%] right-[12%] w-[40%] drop-shadow-[0_20px_20px_rgba(0,0,0,.35)]" />
                )}
              </motion.div>
            </AnimatePresence>
            <motion.span
              key={`n${active}`}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="display absolute bottom-[8%] left-[12%] text-[7rem] leading-none text-turmeric"
            >
              {String(active + 1).padStart(2, "0")}
            </motion.span>
          </div>
        </div>

        <ol className="md:col-span-5 md:col-start-8">
          {STAGES.map((s, i) => (
            <li key={s.key} data-step className="flex min-h-[38vh] flex-col justify-center border-t border-rule py-10 md:min-h-[62vh]">
              <span className={`lnum text-sm transition-colors duration-500 ${active === i ? "text-kumkum" : "text-ink-mute"}`}>
                {String(i + 1).padStart(2, "0")} / 04
              </span>
              <h3 className={`display mt-3 text-[clamp(2.6rem,5vw,4.6rem)] transition-[color,transform] duration-700 ${active === i ? "translate-x-0 text-ink" : "text-ink/30 md:translate-x-4"}`}>
                {t(`s${s.key}t`)}
              </h3>
              <p className={`mt-4 max-w-md text-lg transition-opacity duration-700 ${active === i ? "opacity-100" : "opacity-50"}`}>{t(`s${s.key}`)}</p>
              <div className={`mt-8 aspect-[4/3] w-full max-w-md overflow-hidden rounded-[24px] shadow-[0_24px_50px_-28px_rgba(42,26,18,.5)] transition-[opacity,transform] duration-700 ${active === i ? "opacity-100" : "opacity-60 md:scale-[0.97]"}`}>
                <StepMedia media={media[s.key]} art={s.art[0]} n={i + 1} label={media[s.key] ? t(`s${s.key}t`) : tp("soon")} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
