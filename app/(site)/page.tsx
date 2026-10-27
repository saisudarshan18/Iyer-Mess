import { pageMeta } from "@/lib/seo";
import { Hero } from "@/components/home/Hero";
import { MarqueeBand } from "@/components/home/MarqueeBand";
import { Story } from "@/components/home/Story";
import { Almanac } from "@/components/home/Almanac";
import { Combos } from "@/components/home/Combos";
import { Process } from "@/components/home/Process";
import { Reach } from "@/components/home/Reach";
import { VisitShop } from "@/components/site/VisitShop";
import { OfferShowcase } from "@/components/shop/OfferShowcase";

export const metadata = pageMeta({ path: "/" });

export default function Home() {
  return (
    <>
      <Hero />
      <OfferShowcase className="bg-paper py-16 md:py-24" />
      <MarqueeBand />
      <Story />
      <Almanac />
      <Combos />
      <Process />
      <Reach />
      <VisitShop id="visit" />
    </>
  );
}
