import { SweetGlyph } from "@/components/art/SweetGlyph";
import { getPublicStorefront } from "@/lib/data";
import { formatINR } from "@/lib/pricing";
import { OG_SIZE, ogCard } from "@/lib/server/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;
export const alt = "Iyer Mess";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { products } = await getPublicStorefront();
  const p = products.find((x) => x.slug === slug);
  if (!p) return ogCard({ kicker: "Sweets & Savories", title: "Iyer", accent: "Mess" });
  const words = p.name_en.split(" ");
  return ogCard({
    kicker: p.category === "sweet" ? "Sweets" : "Savories",
    title: words.length > 1 ? words.slice(0, -1).join(" ") : p.name_en,
    accent: words.length > 1 ? words.at(-1) : undefined,
    subline: "¼ kg · ½ kg · 1 kg packs",
    price: `${formatINR(p.price_per_kg)} / kg`,
    art: p.image ?? (
      <div style={{ display: "flex", width: 420, height: 420 }}>
        <SweetGlyph slug={p.slug} size={420} />
      </div>
    ),
  });
}
