import "server-only";
import { ImageResponse } from "next/og";
import { Children, Fragment, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { markSvg } from "@/lib/kolam";

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * The OG renderer only understands plain elements inside <svg>, so expand our
 * (pure, hook-free) art components into the elements they return.
 */
export function expand(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(expand);
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (typeof el.type === "function") return expand((el.type as (p: unknown) => ReactNode)(el.props));
  if ((el.type as unknown) === Fragment) return Children.toArray(el.props.children).map(expand);
  return el.props.children === undefined ? el : cloneElement(el, undefined, ...Children.toArray(el.props.children).map(expand));
}

/** Google Fonts serves TTF (which the OG renderer needs) when asked without a browser user-agent. */
async function font(query: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${query}&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

/**
 * The share card: paper background, seal, kicker, big serif title (with an
 * italic maroon accent), a subline, optional price, and an artwork on the right.
 */
export async function ogCard({
  kicker,
  title,
  accent,
  subline,
  price,
  art,
}: {
  kicker: string;
  title: string;
  accent?: string;
  subline?: string;
  price?: string;
  art?: ReactNode | string; // inline <svg> element, or an https image url
}) {
  const latin = `${kicker}${title}${accent ?? ""}${subline ?? ""}${price ?? ""}Iyer Mess ·Sweets Savories Gift boxes`;
  const [serif, italic, regular, symbols] = await Promise.all([
    font("Literata:wght@600", latin),
    font("Literata:ital,wght@1,400", `${accent ?? ""}Mess`),
    font("Literata:wght@400", latin),
    font("Noto+Sans:wght@600", "₹·"), // Literata has no rupee sign
  ]);
  const fonts = [
    serif && { name: "Literata", data: serif, weight: 600 as const, style: "normal" as const },
    italic && { name: "Literata", data: italic, weight: 400 as const, style: "italic" as const },
    regular && { name: "Literata", data: regular, weight: 400 as const, style: "normal" as const },
    symbols && { name: "Symbols", data: symbols, weight: 600 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" | "italic" }[];

  const artUrl = typeof art === "string" ? art : null;
  const chars = title.length + (accent ? accent.length + 1 : 0);
  const titleSize = chars <= 9 ? 124 : chars <= 14 ? 96 : chars <= 20 ? 78 : 64;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f4ebdd", color: "#2a1a12", fontFamily: "Literata, Symbols", position: "relative" }}>
        {/* turmeric half-disc behind the art */}
        <div style={{ position: "absolute", right: -140, top: 55, width: 640, height: 640, borderRadius: 999, background: "#ead9b6", display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 0 60px 80px", width: art ? 700 : 1100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgUri(markSvg({ size: 64 }))} width={64} height={64} alt="" />
            <div style={{ display: "flex", fontSize: 34, fontWeight: 600, letterSpacing: -1 }}>
              Iyer<span style={{ fontStyle: "italic", fontWeight: 400, color: "#7a1f1f", marginLeft: 8 }}>Mess</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 24, letterSpacing: 5, textTransform: "uppercase", color: "#5b4636", marginBottom: 14 }}>{kicker}</div>
            {/* one span per word so wrapped lines start flush left */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0 0.22em", fontSize: titleSize, fontWeight: 600, letterSpacing: -3, lineHeight: 1 }}>
              {title.split(" ").map((w, i) => (
                <span key={i}>{w}</span>
              ))}
              {accent?.split(" ").map((w, i) => (
                <span key={`a${i}`} style={{ fontStyle: "italic", fontWeight: 400, color: "#7a1f1f" }}>
                  {w}
                </span>
              ))}
            </div>
            {/* Tamil is left out: the OG renderer can't shape Tamil vowel signs. The home card (a real-browser render) keeps it. */}
            {subline && <div style={{ fontSize: 30, color: "#5b4636", marginTop: 20 }}>{subline}</div>}
          </div>
          {price ? (
            <div style={{ display: "flex", alignSelf: "flex-start", background: "#2a1a12", color: "#f4ebdd", fontSize: 32, padding: "12px 28px", borderRadius: 999 }}>{price}</div>
          ) : (
            <div style={{ display: "flex", fontSize: 26, color: "#5b4636" }}>Sweets · Savories · Gift boxes</div>
          )}
        </div>
        {art && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 500 }}>
            {artUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artUrl} width={420} height={420} alt="" style={{ objectFit: "contain" }} />
            ) : (
              expand(art)
            )}
          </div>
        )}
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
