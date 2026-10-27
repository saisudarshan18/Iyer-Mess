import { SweetGlyph } from "@/components/art/SweetGlyph";
import { getPublicStorefront } from "@/lib/data";
import { comboTotal, formatINR } from "@/lib/pricing";
import { OG_SIZE, ogCard } from "@/lib/server/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;
export const alt = "Iyer Mess gift boxes";

const at = (left: number, top: number, w: number) => ({ position: "absolute" as const, left, top, width: w, height: w, display: "flex" });

export default async function Image() {
  const { combos } = await getPublicStorefront();
  const from = combos.length ? Math.min(...combos.map(comboTotal)) : null;
  return ogCard({
    kicker: `${combos.length} boxes · packing included`,
    title: "Gift",
    accent: "boxes",
    subline: "Delivered within a day locally, or by courier",
    price: from ? `from ${formatINR(from)}` : undefined,
    // a box with sweets heaped on top
    art: (
      <div style={{ position: "relative", display: "flex", width: 420, height: 420 }}>
        <div style={at(10, 40, 230)}><SweetGlyph slug="jangiri" size={230} /></div>
        <div style={at(150, 0, 240)}><SweetGlyph slug="laddu" size={240} /></div>
        <div style={at(190, 110, 200)}><SweetGlyph slug="ghee-mysore-pak" size={200} /></div>
        <div style={{ position: "absolute", left: 30, top: 230, width: 360, height: 160, borderRadius: 18, background: "#7a1f1f", display: "flex" }} />
        <div style={{ position: "absolute", left: 30, top: 230, width: 360, height: 18, background: "#5a1414", display: "flex" }} />
      </div>
    ),
  });
}
