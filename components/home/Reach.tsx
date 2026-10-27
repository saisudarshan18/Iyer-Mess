"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Magnetic } from "@/components/motion/Magnetic";
import { gsap, useGsap } from "@/components/motion/useGsap";
import { useStore } from "@/components/site/StoreProvider";
import { Arrow } from "./Hero";

/** Delivery reach drawn as rings around the shop: local radius, then the rest of the state. */
export function Reach() {
  const t = useTranslations("delivery");
  const { settings } = useStore();
  const ref = useRef<HTMLElement>(null);
  const km = settings.local_radius_km;

  useGsap(ref, (mm, el) => {
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 70%", end: "center center", scrub: 0.6 } });
      el.querySelectorAll<SVGGeometryElement>("[data-ring]").forEach((ring, i) => {
        const len = ring.getTotalLength();
        gsap.set(ring, { strokeDasharray: len, strokeDashoffset: len });
        tl.to(ring, { strokeDashoffset: 0, ease: "none" }, i * 0.25);
      });
      tl.from(el.querySelectorAll("[data-ping]"), { scale: 0, transformOrigin: "center", stagger: 0.1, ease: "back.out(2)" }, 0.3);
      tl.from(el.querySelectorAll("[data-reach-col]"), { y: 40, opacity: 0, stagger: 0.12 }, 0.2);
    });
  });

  return (
    <section ref={ref} className="relative overflow-hidden bg-turmeric px-[var(--gutter)] py-28 text-ink md:py-36">
      <div className="grid items-center gap-14 md:grid-cols-12">
        <div className="relative mx-auto aspect-square w-full max-w-[520px] md:col-span-6">
          <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden>
            <circle data-ring cx="200" cy="200" r="190" fill="none" stroke="#2a1a12" strokeWidth="1.2" strokeDasharray="2 8" />
            <circle data-ring cx="200" cy="200" r="140" fill="none" stroke="#2a1a12" strokeWidth="1" />
            <circle data-ring cx="200" cy="200" r="78" fill="none" stroke="#7a1f1f" strokeWidth="2.6" />
            <circle cx="200" cy="200" r="78" fill="#7a1f1f" opacity=".1" />
            <circle data-ping cx="200" cy="200" r="9" fill="#2a1a12" />
            <circle cx="200" cy="200" r="9" fill="none" stroke="#2a1a12" className="origin-center animate-[ping_2.4s_cubic-bezier(0,0,.2,1)_infinite]" style={{ transformBox: "fill-box" }} />
            {[
              [258, 160],
              [150, 250],
              [300, 300],
              [96, 120],
              [330, 110],
            ].map(([x, y], i) => (
              <circle key={i} data-ping cx={x} cy={y} r={i < 2 ? 5 : 4} fill={i < 2 ? "#7a1f1f" : "#2a1a12"} />
            ))}
            <text x="200" y="232" textAnchor="middle" fontSize="13" fill="#2a1a12" style={{ fontFamily: "var(--font-literata)" }}>
              {settings.shop_name}
            </text>
            <text x="200" y="112" textAnchor="middle" fontSize="12" fill="#7a1f1f" style={{ fontFamily: "var(--font-literata)", letterSpacing: ".2em" }}>
              {km} KM
            </text>
          </svg>
        </div>

        <div className="md:col-span-5 md:col-start-8">
          <p className="folio !text-ink/70 after:!bg-ink/25">{t("chapter")}</p>
          <h2 className="display mt-6 text-[clamp(3rem,6vw,5.5rem)]">{t("title")}</h2>
          <dl className="mt-10 space-y-7">
            {[
              [t("localT", { km }), t("local")],
              [t("courierT"), t("courier")],
              [t("takeawayT"), t("takeaway")],
            ].map(([title, body]) => (
              <div key={title} data-reach-col className="grid grid-cols-[auto_1fr] gap-x-4">
                <span className="mt-2.5 h-2 w-2 rounded-full bg-maroon" />
                <dt className="display text-2xl">{title}</dt>
                <dd className="col-start-2 mt-1 text-ink/75">{body}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-sm text-ink/70">{t("fees", { km })}</p>
          <Magnetic className="mt-8">
            <Link href="/menu" className="btn">
              {t("cta")} <Arrow />
            </Link>
          </Magnetic>
        </div>
      </div>
    </section>
  );
}
