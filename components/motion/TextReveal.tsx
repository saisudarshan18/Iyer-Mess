"use client";

import { useRef } from "react";
import { gsap, useGsap } from "./useGsap";

/**
 * Words brighten one after another as the paragraph scrolls through the
 * viewport (Magic UI "Text Reveal", scrubbed with ScrollTrigger).
 */
export function TextReveal({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(/\s+/);

  useGsap(
    ref,
    (mm, el) => {
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          el.querySelectorAll("[data-word]"),
          { opacity: 0.14 },
          {
            opacity: 1,
            stagger: 0.08,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: 0.6 },
          },
        );
      });
    },
    [text],
  );

  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <span key={i} data-word className="inline-block">
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}
