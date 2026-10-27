"use client";

import { useRef } from "react";

/**
 * A spotlight follows the cursor and the card tilts a few degrees towards it
 * (Magic UI "Magic Card" + a 3D tilt). Pointer-only; touch gets a flat card.
 */
export function MagicCard({
  children,
  className,
  tilt = 6,
  glow = "rgba(217, 162, 27, 0.28)",
}: {
  children: React.ReactNode;
  className?: string;
  tilt?: number;
  glow?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--rx", `${(0.5 - y) * tilt}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * tilt}deg`);
    el.style.setProperty("--spot", "1");
  };
  const onLeave = () => {
    const el = ref.current!;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--spot", "0");
  };

  return (
    <div style={{ perspective: "900px" }} className={className}>
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="relative h-full transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] [transform-style:preserve-3d]"
        style={{ transform: "rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))" }}
      >
        {children}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          style={{
            opacity: "var(--spot, 0)",
            background: `radial-gradient(420px circle at var(--mx,50%) var(--my,50%), ${glow}, transparent 45%)`,
            mixBlendMode: "multiply",
            borderRadius: "inherit",
          }}
        />
      </div>
    </div>
  );
}
