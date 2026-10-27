import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { MenuView } from "@/components/shop/MenuView";

export const metadata: Metadata = pageMeta({
  title: "Menu",
  description: "Laddu, Mysore pak, jangiri, murukku, mixture and more. Priced per kg, in ¼ kg, ½ kg and 1 kg packs.",
  path: "/menu",
});

export default function MenuPage() {
  return <MenuView />;
}
