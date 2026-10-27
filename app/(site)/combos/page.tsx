import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { Combos } from "@/components/home/Combos";
import { OfferShowcase } from "@/components/shop/OfferShowcase";

export const metadata: Metadata = pageMeta({
  title: "Gift boxes",
  description: "Ready gift boxes of our most-loved sweets and savories, packing included. Delivered locally within a day or by courier across Tamil Nadu.",
  path: "/combos",
  ownImage: true,
});

export default function CombosPage() {
  return (
    <div className="pt-16">
      <OfferShowcase className="bg-paper-2 pt-16" />
      <Combos />
    </div>
  );
}
