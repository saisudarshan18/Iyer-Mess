import Link from "next/link";
import { LegalPage } from "@/components/site/LegalPage";
import { getPublicStorefront } from "@/lib/data";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Delivery & shipping", description: "Local delivery, courier and takeaway from Iyer Mess: areas, timing and charges.", path: "/shipping" });
export const revalidate = 3600;

export default async function ShippingPage() {
  const { settings: s } = await getPublicStorefront();
  return (
    <LegalPage
      title="Delivery & shipping"
      updated="October 2026"
      intro={<>Every order from {s.shop_name} goes out one of three ways. You choose at checkout and always see the full charge before you pay.</>}
      sections={[
        {
          id: "local",
          title: "Local delivery",
          body: <p>Within {s.local_radius_km} km of the shop, we deliver ourselves within a day, in the time slot you pick at checkout.</p>,
        },
        {
          id: "courier",
          title: "Courier",
          body: (
            <p>
              Beyond {s.local_radius_km} km, anywhere in {s.allowed_state}, we send your order by courier. Courier charges are as per the courier company and depend on the parcel&rsquo;s weight and your address, so
              at checkout you send us a courier request instead of paying. We weigh the parcel and send you the courier charge on the website, WhatsApp and email. If you approve, you pay the full amount by
              UPI and only then is the order placed. You get the courier name and tracking number once it&rsquo;s shipped. Delivery time depends on distance and the courier, so times are estimates.
            </p>
          ),
        },
        {
          id: "takeaway",
          title: "Takeaway",
          body: <p>Collect from the shop in the slot you choose. We&rsquo;ll let you know when it&rsquo;s ready.</p>,
        },
        {
          id: "charges",
          title: "Charges",
          body: <p>Local delivery charges depend on the distance from the shop to your pin on the map, and are shown at checkout. Courier charges beyond {s.local_radius_km} km are as per the courier company and are quoted to you before you pay.</p>,
        },
        {
          id: "problems",
          title: "Something wrong?",
          body: (
            <p>
              If your order arrives damaged or something is missing, <Link href="/contact" className="ink-link">contact us</Link> as soon as you can (photos help).
            </p>
          ),
        },
      ]}
    />
  );
}
