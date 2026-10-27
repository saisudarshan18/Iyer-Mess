/** Kolam curve maths shared by the React art and the icon generator. Each curve is one closed path. */

type Pt = [number, number];

const f = (n: number) => (Math.round(n * 100) / 100).toString();

function toPath(points: Pt[]): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join("") + "Z";
}

/** Epitrochoid: R fixed circle, r rolling circle, d pen offset. Lobes = R/r. */
export function epitrochoid(cx: number, cy: number, R: number, r: number, d: number, scale: number, steps = 900): string {
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = (R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t);
    const y = (R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t);
    pts.push([cx + x * scale, cy + y * scale]);
  }
  return toPath(pts);
}

/** Rose curve r = base + amp·cos(kθ), so petals loop. */
export function rose(cx: number, cy: number, base: number, amp: number, k: number, steps = 720): string {
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const rr = base + amp * Math.cos(k * t);
    pts.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t)]);
  }
  return toPath(pts);
}

/** Points evenly spaced on a circle (the pulli dots). */
export function ring(cx: number, cy: number, radius: number, count: number, offset = 0): Pt[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + offset;
    return [Math.round((cx + radius * Math.cos(a)) * 100) / 100, Math.round((cy + radius * Math.sin(a)) * 100) / 100];
  });
}

/**
 * The Iyer Mess mark: a maroon seal holding a four-lobed kolam knot drawn in
 * turmeric around four pulli and a centre dot, like a sweet on a plate.
 * Returned as SVG markup so it can be written to icon files.
 */
export function markSvg({ size = 64, rounded = true }: { size?: number; rounded?: boolean } = {}) {
  const c = 32;
  const knot = epitrochoid(c, c, 4, 1, 2.3, 3.55, 400);
  const inner = rose(c, c, 7.2, 3.2, 4, 240);
  const dots = ring(c, c, 11.2, 4, Math.PI / 4)
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.9" fill="#f4ebdd"/>`)
    .join("");
  const bg = rounded ? `<rect width="64" height="64" rx="15" fill="#7a1f1f"/>` : `<rect width="64" height="64" fill="#7a1f1f"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${bg}<circle cx="32" cy="32" r="28.5" fill="none" stroke="#d9a21b" stroke-width="1" stroke-dasharray="1.2 2.6" opacity=".7"/><path d="${knot}" fill="none" stroke="#d9a21b" stroke-width="2.6" stroke-linejoin="round"/><path d="${inner}" fill="none" stroke="#f0d58a" stroke-width="1.3" opacity=".85"/>${dots}<circle cx="32" cy="32" r="2.6" fill="#d9a21b"/></svg>`;
}
