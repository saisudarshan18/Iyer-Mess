import { epitrochoid, ring, rose } from "@/lib/kolam";

const KNOT = epitrochoid(32, 32, 4, 1, 2.3, 3.55, 400);
const INNER = rose(32, 32, 7.2, 3.2, 4, 240);
const DOTS = ring(32, 32, 11.2, 4, Math.PI / 4);

/** The seal: a four-lobed kolam knot on maroon. Same drawing as the favicon (lib/kolam.ts → markSvg). */
export function LogoMark({ className, spin = false }: { className?: string; spin?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="15" fill="#7a1f1f" />
      <circle cx="32" cy="32" r="28.5" fill="none" stroke="#d9a21b" strokeWidth="1" strokeDasharray="1.2 2.6" opacity=".7" />
      <g className={spin ? "origin-center transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] [transform-box:fill-box] group-hover:rotate-90" : undefined}>
        <path d={KNOT} fill="none" stroke="#d9a21b" strokeWidth="2.6" strokeLinejoin="round" />
        <path d={INNER} fill="none" stroke="#f0d58a" strokeWidth="1.3" opacity=".85" />
      </g>
      {DOTS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.9" fill="#f4ebdd" />
      ))}
      <circle cx="32" cy="32" r="2.6" fill="#d9a21b" />
    </svg>
  );
}

/** Mark + wordmark lockup. */
export function Logo({ className, tamil = true }: { className?: string; tamil?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark className="h-9 w-9 shrink-0 drop-shadow-[0_4px_8px_rgba(122,31,31,.25)]" spin />
      <span className="flex flex-col leading-none">
        <span className="display text-[1.5rem] !leading-[1.05] tracking-[-0.03em]">
          Iyer<span className="display-italic text-maroon"> Mess</span>
        </span>
        {tamil && <span className="tamil mt-1 text-[0.68rem] leading-none text-ink-soft">ஐய்யர் மெஸ்</span>}
      </span>
    </span>
  );
}
