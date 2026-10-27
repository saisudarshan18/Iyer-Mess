/**
 * Generative kolam: a continuous epitrochoid loop around a ring of pulli
 * (dots), with an inner rose. Each curve is one unbroken path, so it can be
 * drawn on scroll with stroke-dashoffset.
 */

import { epitrochoid, ring as ringPoints, rose } from "@/lib/kolam";

export { epitrochoid, rose };

export function Kolam({
  size = 600,
  lobes = 8,
  className,
  stroke = "currentColor",
  strokeWidth = 1.6,
  dots = true,
}: {
  size?: number;
  lobes?: number;
  className?: string;
  stroke?: string;
  strokeWidth?: number;
  dots?: boolean;
}) {
  const c = size / 2;
  const outer = epitrochoid(c, c, lobes, 1, 2.4, (size * 0.43) / (lobes + 3.4));
  const middle = rose(c, c, size * 0.2, size * 0.075, lobes);
  const inner = rose(c, c, size * 0.085, size * 0.045, lobes / 2);
  const ring = (radius: number, count: number, offset = 0) => ringPoints(c, c, radius, count, offset);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} fill="none" aria-hidden>
      <g stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <path data-draw d={outer} />
        <path data-draw d={middle} />
        <path data-draw d={inner} />
        <circle data-draw cx={c} cy={c} r={size * 0.475} strokeDasharray="1 9" />
      </g>
      {dots && (
        <g fill={stroke}>
          {ring(size * 0.33, lobes, Math.PI / lobes).map(([x, y], i) => (
            <circle key={`a${i}`} data-dot cx={x} cy={y} r={size * 0.008} />
          ))}
          {ring(size * 0.135, lobes, 0).map(([x, y], i) => (
            <circle key={`b${i}`} data-dot cx={x} cy={y} r={size * 0.006} />
          ))}
          <circle data-dot cx={c} cy={c} r={size * 0.01} />
        </g>
      )}
    </svg>
  );
}

/** A small single-line kolam knot used as a list bullet / divider. */
export function KolamKnot({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} fill="none" aria-hidden>
      <path d={epitrochoid(20, 20, 4, 1, 2.2, 2.6, 240)} stroke="currentColor" strokeWidth="1.6" />
      <circle cx="20" cy="20" r="1.8" fill="currentColor" />
    </svg>
  );
}
