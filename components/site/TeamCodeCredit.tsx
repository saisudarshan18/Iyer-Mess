"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { Magnetic } from "@/components/motion/Magnetic";

const HEART = "M12 21s-7.5-4.6-9.6-9.4C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.7 1.2 5.4 3.2 1.7-2 3.3-3.2 5.4-3.2 3.6 0 5.7 3.7 4.2 7.1C19.5 16.4 12 21 12 21z";
const COLOURS = ["#c2362b", "#d9a21b", "#f0d58a", "#e8665a"];

type Floater = { id: number; x: number; rot: number; size: number; colour: string; delay: number };

/**
 * "Made with ♥ by Team Code". On hover/focus the heart races and throws
 * little hearts upward, the letters of "Team Code" ripple, an underline
 * draws in and an arrow slides out. Clicking bursts more hearts on the way out.
 */
export function TeamCodeCredit() {
  const reduce = useReducedMotion();
  const [hot, setHot] = useState(false);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const seq = useRef(0);

  const burst = (n: number) => {
    if (reduce) return;
    const fresh = Array.from({ length: n }, (_, i) => ({
      id: ++seq.current,
      x: (Math.random() - 0.5) * 90,
      rot: (Math.random() - 0.5) * 60,
      size: 12 + Math.random() * 12,
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
      delay: i * 0.05,
    }));
    setFloaters((f) => [...f, ...fresh]);
    setTimeout(() => setFloaters((f) => f.filter((x) => !fresh.includes(x))), 1600);
  };

  const enter = () => {
    setHot(true);
    burst(5);
  };

  return (
    <Magnetic strength={0.25}>
      <a
        href="https://www.teamcode.in/"
        target="_blank"
        rel="noopener noreferrer"
        onPointerEnter={enter}
        onPointerLeave={() => setHot(false)}
        onFocus={enter}
        onBlur={() => setHot(false)}
        onClick={() => burst(10)}
        className="group relative inline-flex items-center gap-2 rounded-full px-5 py-3 text-base text-paper/75 md:text-lg transition-colors duration-300 hover:bg-paper/[0.06] hover:text-paper focus-visible:text-paper"
        aria-label="Made with love by Team Code (opens teamcode.in)"
      >
        <span>Made with</span>

        <span className="relative inline-grid place-items-center">
          <motion.svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            className="fill-kumkum"
            animate={reduce ? undefined : { scale: hot ? [1, 1.45, 1, 1.3, 1] : [1, 1.2, 1, 1.12, 1] }}
            transition={{ duration: hot ? 0.7 : 1.6, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          >
            <path d={HEART} />
          </motion.svg>
          <AnimatePresence>
            {floaters.map((f) => (
              <motion.svg
                key={f.id}
                viewBox="0 0 24 24"
                width={f.size}
                height={f.size}
                className="pointer-events-none absolute"
                style={{ fill: f.colour }}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
                animate={{ x: f.x, y: -70 - Math.abs(f.x) * 0.45, opacity: [0, 1, 0], scale: 1, rotate: f.rot }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.3, delay: f.delay, ease: [0.16, 1, 0.3, 1] }}
                aria-hidden
              >
                <path d={HEART} />
              </motion.svg>
            ))}
          </AnimatePresence>
        </span>

        <span>by</span>

        <span className="relative font-semibold text-paper group-hover:text-turmeric">
          {"Team Code".split("").map((ch, i) => (
            <motion.span
              key={i}
              className="inline-block"
              animate={hot && !reduce ? { y: [0, -4, 0] } : { y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.035, ease: "easeOut" }}
            >
              {ch === " " ? " " : ch}
            </motion.span>
          ))}
          <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-turmeric transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100" />
        </span>

        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          className="-ml-1 w-0 -translate-x-1 opacity-0 transition-all duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:ml-0 group-hover:w-[16px] group-hover:translate-x-0 group-hover:-translate-y-0.5 group-hover:text-turmeric group-hover:opacity-100 group-focus-visible:w-[16px] group-focus-visible:opacity-100"
          aria-hidden
        >
          <path d="M7 17 17 7M8 7h9v9" />
        </svg>
      </a>
    </Magnetic>
  );
}
