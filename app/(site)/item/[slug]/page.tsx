import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefront } from "@/lib/data";
import { pageMeta } from "@/lib/seo";
import { ItemDetail } from "@/components/shop/ItemDetail";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { products } = await getStorefront();
  const p = products.find((x) => x.slug === slug);
  if (!p) return {};
  return pageMeta({
    title: `${p.name_en} · ${p.name_ta}`,
    description: p.description_en ?? `${p.name_en} (${p.name_ta}) from Iyer Mess: ₹${p.price_per_kg} per kg, in ¼ kg, ½ kg and 1 kg packs.`,
    path: `/item/${p.slug}`,
    ownImage: true,
  });
}

export default async function ItemPage({ params }: Props) {
  const { slug } = await params;
  const { products } = await getStorefront();
  const product = products.find((p) => p.slug === slug);
  if (!product) notFound();
  return <ItemDetail product={product} />;
}
