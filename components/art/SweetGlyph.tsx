import Image from "next/image";

/**
 * Ink-stamp illustrations of each sweet and savory, drawn in SVG.
 * Shown until real product photos are uploaded (products.image).
 * Deterministic (seeded) so server and client render identically.
 */

const INK = "#2a1a12";

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** Round so Node and the browser print identical attributes (trig differs in the last digits). */
const r2 = (n: number) => Math.round(n * 100) / 100;

function seedOf(s: string) {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 2147483647;
  return h || 1;
}

const spiral = (cx: number, cy: number, turns: number, r0: number, r1: number, steps = 360) => {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    d += `${i ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return d;
};

const spikySpiral = (cx: number, cy: number, turns: number, r0: number, r1: number, spikes: number) => {
  let d = "";
  const steps = 900;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t + Math.sin(a * spikes) * 2.6;
    d += `${i ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return d;
};

const scallop = (cx: number, cy: number, r: number, n: number, depth: number) => {
  let d = "";
  for (let i = 0; i <= 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    const rr = r + Math.cos(a * n) * depth;
    d += `${i ? "L" : "M"}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }
  return d + "Z";
};

function Dots({ seed, n, cx, cy, r, fill, size = [1.2, 2.6] }: { seed: string; n: number; cx: number; cy: number; r: number; fill: string; size?: [number, number] }) {
  const rand = rng(seedOf(seed));
  return (
    <g fill={fill}>
      {Array.from({ length: n }, (_, i) => {
        const a = rand() * Math.PI * 2;
        const rr = Math.sqrt(rand()) * r;
        return <circle key={i} cx={r2(cx + rr * Math.cos(a))} cy={r2(cy + rr * Math.sin(a))} r={r2(size[0] + rand() * (size[1] - size[0]))} />;
      })}
    </g>
  );
}

function Shadow() {
  return <ellipse cx="100" cy="172" rx="62" ry="9" fill={INK} opacity="0.12" />;
}

const stroke = { stroke: INK, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Art({ slug }: { slug: string }) {
  switch (slug) {
    case "laddu":
      return (
        <>
          <Shadow />
          <circle cx="100" cy="100" r="58" fill="#e9a51f" {...stroke} />
          <Dots seed={slug} n={140} cx={100} cy={100} r={54} fill="#c97f12" />
          <Dots seed={slug + "h"} n={40} cx={84} cy={82} r={22} fill="#f7cf6a" />
          <path d="M112 66c8 2 14 8 10 14-5-2-9-6-10-14Z" fill="#f3e3c1" {...stroke} strokeWidth={1.6} />
        </>
      );
    case "ravaladdu":
      return (
        <>
          <Shadow />
          <circle cx="100" cy="100" r="56" fill="#efe0bd" {...stroke} />
          <Dots seed={slug} n={220} cx={100} cy={100} r={52} fill="#cdb27a" size={[0.8, 1.6]} />
          <ellipse cx="86" cy="92" rx="5" ry="3.4" fill="#4a2318" transform="rotate(-20 86 92)" />
          <ellipse cx="116" cy="114" rx="5" ry="3.4" fill="#4a2318" transform="rotate(30 116 114)" />
          <path d="M104 74c6 0 11 4 9 9-5-1-8-4-9-9Z" fill="#f6ead0" {...stroke} strokeWidth={1.4} />
        </>
      );
    case "jangiri": {
      // the jangiri's ring of loops is literally a rose curve
      let d = "";
      for (let i = 0; i <= 720; i++) {
        const t = (i / 720) * Math.PI * 2;
        const r = 40 + 18 * Math.cos(9 * t);
        d += `${i ? "L" : "M"}${(100 + r * Math.cos(t)).toFixed(1)} ${(100 + r * Math.sin(t)).toFixed(1)}`;
      }
      return (
        <>
          <Shadow />
          <path d={d + "Z"} fill="none" stroke="#a8360f" strokeWidth="13" strokeLinejoin="round" />
          <path d={d + "Z"} fill="none" stroke="#ea6a1f" strokeWidth="8.5" strokeLinejoin="round" />
          <path d={d + "Z"} fill="none" stroke="#ffb15a" strokeWidth="2" strokeDasharray="6 10" />
          <circle cx="100" cy="100" r="14" fill="none" stroke="#ea6a1f" strokeWidth="8" />
        </>
      );
    }
    case "oil-mysore-pak":
    case "ghee-mysore-pak": {
      const ghee = slug.startsWith("ghee");
      return (
        <>
          <Shadow />
          <g transform="rotate(-8 100 100)">
            <rect x="48" y="64" width="104" height="76" rx="10" fill={ghee ? "#f2c35a" : "#d79a2b"} {...stroke} />
            <path d="M48 82h104" stroke={ghee ? "#c98d1c" : "#a86d14"} strokeWidth="3" opacity=".6" />
            <Dots seed={slug} n={46} cx={100} cy={110} r={34} fill={ghee ? "#c98d1c" : "#9a5e10"} size={[1.4, 3.2]} />
            {ghee && <path d="M58 72c18-4 44-4 70 0" stroke="#fff3c4" strokeWidth="4" strokeLinecap="round" opacity=".8" />}
          </g>
        </>
      );
    }
    case "badhusha":
      return (
        <>
          <Shadow />
          <path d={scallop(100, 104, 54, 12, 4)} fill="#d9902e" {...stroke} />
          <path d={spiral(100, 104, 2.2, 6, 36)} stroke="#a3601a" strokeWidth="3.4" fill="none" strokeLinecap="round" />
          <ellipse cx="100" cy="96" rx="40" ry="20" fill="#fff0c9" opacity=".25" />
          <Dots seed={slug} n={18} cx={100} cy={100} r={40} fill="#fff6dc" size={[1, 2]} />
        </>
      );
    case "cashewnut-cake":
      return (
        <>
          <Shadow />
          <path d="M100 42 156 100 100 158 44 100Z" fill="#f4e6c8" {...stroke} />
          <path d="M100 54 144 100 100 146 56 100Z" fill="none" stroke="#d7c297" strokeWidth="2" />
          <path d="M70 92c10-6 22-8 34-4" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".9" />
          <Dots seed={slug} n={10} cx={100} cy={100} r={30} fill="#c9c1b2" size={[1, 1.8]} />
        </>
      );
    case "bombay-kaju":
      return (
        <>
          <Shadow />
          <g transform="rotate(12 100 100)">
            <path d="M100 48 150 100 100 152 50 100Z" fill="#e8b46a" {...stroke} />
            {[-24, -12, 0, 12, 24].map((o) => (
              <path key={o} d={`M${76 + o} ${100 - 24 + o} l48 0`} stroke="#b97a2c" strokeWidth="2.4" strokeLinecap="round" transform={`rotate(45 100 100)`} />
            ))}
            <path d="M88 86c8-4 16-4 22 0" stroke="#fff1d0" strokeWidth="3" strokeLinecap="round" />
          </g>
        </>
      );
    case "makanbeda":
      return (
        <>
          <Shadow />
          <ellipse cx="100" cy="106" rx="56" ry="48" fill="#5b2412" {...stroke} />
          <ellipse cx="82" cy="88" rx="16" ry="9" fill="#a8532c" opacity=".7" transform="rotate(-25 82 88)" />
          <path d="M58 132c18 14 66 14 84 0" stroke="#2c0f06" strokeWidth="3" fill="none" />
          <circle cx="76" cy="84" r="3" fill="#ffd9a8" />
        </>
      );
    case "adhirasam":
      return (
        <>
          <Shadow />
          <circle cx="100" cy="102" r="58" fill="#6e3414" {...stroke} />
          <circle cx="100" cy="102" r="40" fill="none" stroke="#4a200b" strokeWidth="3" />
          <circle cx="100" cy="102" r="10" fill="#4a200b" />
          <Dots seed={slug} n={60} cx={100} cy={102} r={54} fill="#f1e2c3" size={[1, 1.8]} />
          <path d="M66 76c14-10 32-14 50-10" stroke="#b9703c" strokeWidth="4" strokeLinecap="round" opacity=".7" />
        </>
      );
    case "legiyam":
      return (
        <>
          <Shadow />
          <path d="M66 74h68l-6 84c-1 8-8 12-28 12s-27-4-28-12Z" fill="#b5653a" {...stroke} />
          <path d="M60 64h80v14H60z" fill="#8f4a27" {...stroke} />
          <path d="M70 66c8-14 52-14 60 0" fill="#3a1d0e" {...stroke} />
          <path d="M72 104h56M74 124h52" stroke="#e7c48e" strokeWidth="2.4" strokeDasharray="2 5" strokeLinecap="round" />
          <path d="M84 84l-2 66" stroke="#d68456" strokeWidth="4" strokeLinecap="round" opacity=".6" />
        </>
      );
    case "mullu-murukku":
      return (
        <>
          <Shadow />
          <path d={spikySpiral(100, 100, 4.2, 6, 58, 34)} fill="none" stroke="#c4801f" strokeWidth="9" strokeLinecap="round" />
          <path d={spikySpiral(100, 100, 4.2, 6, 58, 34)} fill="none" stroke={INK} strokeWidth="1.2" opacity=".55" />
        </>
      );
    case "thenkuzhal":
      return (
        <>
          <Shadow />
          <path d={spiral(100, 100, 4.6, 5, 58)} fill="none" stroke="#e7c27a" strokeWidth="8" strokeLinecap="round" />
          <path d={spiral(100, 100, 4.6, 5, 58)} fill="none" stroke="#b78a3a" strokeWidth="1.4" strokeDasharray="1 4" />
        </>
      );
    case "kai-murukku": {
      const d = spiral(100, 100, 3.4, 8, 56, 140);
      return (
        <>
          <Shadow />
          <path d={d} fill="none" stroke="#bf7a24" strokeWidth="12" strokeLinecap="round" />
          <path d={d} fill="none" stroke="#e4a54a" strokeWidth="12" strokeDasharray="4 7" strokeLinecap="round" />
          <path d={d} fill="none" stroke={INK} strokeWidth="1.2" opacity=".4" />
        </>
      );
    }
    case "thattai":
      return (
        <>
          <Shadow />
          <circle cx="100" cy="102" r="58" fill="#e2b36a" {...stroke} />
          <Dots seed={slug} n={30} cx={100} cy={102} r={50} fill="#8b5a1e" size={[1.6, 2.8]} />
          <Dots seed={slug + "g"} n={16} cx={100} cy={102} r={48} fill="#4c6b33" size={[1.6, 2.4]} />
          <Dots seed={slug + "s"} n={50} cx={100} cy={102} r={52} fill="#f6e8c8" size={[0.8, 1.4]} />
        </>
      );
    case "ribbon":
      return (
        <>
          <Shadow />
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M${42 + i * 8} ${72 + i * 30} q12 -14 24 0 t24 0 t24 0 t24 0 t24 0`}
              fill="none"
              stroke="#d39a3f"
              strokeWidth="14"
              strokeLinecap="round"
              transform={`rotate(${-6 + i * 5} 100 100)`}
            />
          ))}
          {[0, 1, 2].map((i) => (
            <path
              key={`l${i}`}
              d={`M${42 + i * 8} ${72 + i * 30} q12 -14 24 0 t24 0 t24 0 t24 0 t24 0`}
              fill="none"
              stroke="#8f5a1c"
              strokeWidth="1.4"
              strokeDasharray="3 3"
              transform={`rotate(${-6 + i * 5} 100 100)`}
            />
          ))}
        </>
      );
    case "mixer":
    case "spl-mixer": {
      const rand = rng(seedOf(slug));
      const special = slug === "spl-mixer";
      return (
        <>
          <Shadow />
          <ellipse cx="100" cy="128" rx="66" ry="30" fill="#e9c27a" opacity=".55" />
          {Array.from({ length: 70 }, (_, i) => {
            const x = r2(44 + rand() * 112);
            const y = r2(78 + rand() * 72);
            const a = r2(rand() * 180);
            const kind = rand();
            if (kind < 0.5) return <path key={i} d={`M${x} ${y} l${r2(10 + rand() * 10)} 0`} stroke="#e0a336" strokeWidth="3" strokeLinecap="round" transform={`rotate(${a} ${x} ${y})`} />;
            if (kind < 0.72) return <ellipse key={i} cx={x} cy={y} rx="5" ry="3.6" fill="#b06a2c" stroke={INK} strokeWidth=".8" transform={`rotate(${a} ${x} ${y})`} />;
            if (kind < 0.84) return <path key={i} d={`M${x} ${y} q5 -7 10 0 q-5 5 -10 0Z`} fill="#4c6b33" transform={`rotate(${a} ${x} ${y})`} />;
            if (special && kind < 0.94) return <path key={i} d={`M${x} ${y} q6 -6 12 0 q-6 3 -12 0Z`} fill="#f4e6c8" stroke={INK} strokeWidth=".8" transform={`rotate(${a} ${x} ${y})`} />;
            return <circle key={i} cx={x} cy={y} r="2.4" fill="#c2362b" opacity=".8" />;
          })}
        </>
      );
    }
    case "omapodi": {
      const rand = rng(seedOf(slug));
      return (
        <>
          <Shadow />
          {Array.from({ length: 26 }, (_, i) => {
            const x = r2(50 + rand() * 90);
            const y = r2(70 + rand() * 70);
            return (
              <path
                key={i}
                d={`M${x} ${y} q${r2(8 + rand() * 6)} ${r2(-10 + rand() * 20)} ${r2(16 + rand() * 10)} 0 t${r2(16 + rand() * 10)} 0`}
                fill="none"
                stroke={i % 3 ? "#e6c063" : "#c99a35"}
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            );
          })}
        </>
      );
    }
    case "somas": {
      let crimp = "";
      for (let i = 0; i <= 18; i++) {
        const a = Math.PI + (i / 18) * Math.PI;
        const r = i % 2 ? 60 : 54;
        crimp += `${i ? "L" : "M"}${(100 + r * Math.cos(a)).toFixed(1)} ${(122 + r * Math.sin(a)).toFixed(1)}`;
      }
      return (
        <>
          <Shadow />
          <path d="M40 122a60 60 0 0 1 120 0Z" fill="#dca355" {...stroke} />
          <path d={crimp} fill="none" stroke="#9f6420" strokeWidth="3" strokeLinejoin="round" />
          <path d="M64 108c12-22 50-30 72-8" stroke="#f6d79a" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      );
    }
    default:
      return (
        <>
          <Shadow />
          <circle cx="100" cy="100" r="56" fill="#e6c27a" {...stroke} />
        </>
      );
  }
}

export function SweetGlyph({ slug, className, title, size }: { slug: string; className?: string; title?: string; size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <Art slug={slug} />
    </svg>
  );
}

/** A product's photo if uploaded, otherwise its illustration. */
export function ProductArt({
  slug,
  image,
  alt,
  className,
  sizes = "(min-width: 768px) 25vw, 60vw",
}: {
  slug: string;
  image: string | null;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  if (image) {
    return <Image src={image} alt={alt} width={800} height={800} className={`${className ?? ""} object-contain`} sizes={sizes} />;
  }
  return <SweetGlyph slug={slug} className={className} title={alt} />;
}
