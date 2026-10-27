"use client";

import { useEffect, useRef } from "react";
import { useLenis } from "./SmoothScroll";

/**
 * Infinite marquee (Magic UI "Marquee"). The track leans into the scroll:
 * Lenis velocity skews it and speeds it up, then it settles back.
 */
export function Marquee({
  children,
  reverse = false,
  duration = 40,
  gap = "2.5rem",
  className,
}: {
  children: React.ReactNode;
  reverse?: boolean;
  duration?: number;
  gap?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis || !ref.current) return;
    const el = ref.current;
    let skew = 0;
    let raf = 0;
    const loop = () => {
      const target = Math.max(-8, Math.min(8, lenis.velocity * 0.35));
      skew += (target - skew) * 0.12;
      el.style.setProperty("--skew", `${skew.toFixed(2)}deg`);
      el.getAnimations({ subtree: true }).forEach((a) => (a.playbackRate = 1 + Math.min(3, Math.abs(lenis.velocity) / 12)));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [lenis]);

  const style = { "--duration": `${duration}s`, "--gap": gap, "--dir": reverse ? "reverse" : "normal", gap } as React.CSSProperties;

  return (
    <div ref={ref} className={`group flex overflow-hidden ${className ?? ""}`} style={{ ...style, transform: "skewX(var(--skew, 0deg))" }}>
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden={i === 1}
          className="marquee-track flex shrink-0 items-center group-hover:[animation-play-state:paused]"
          style={{ gap }}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
