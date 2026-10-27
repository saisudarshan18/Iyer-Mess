import Link from "next/link";
import { Blank, LegalPage } from "@/components/site/LegalPage";
import { getPublicStorefront } from "@/lib/data";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Cancellations & refunds", description: "How to cancel an Iyer Mess order and how refunds are paid.", path: "/refunds" });
export const revalidate = 3600;

export default async function RefundsPage() {
  const { settings: s } = await getPublicStorefront();
  return (
    <LegalPage
      title="Cancellations & refunds"
      updated="October 2026"
      intro={<>How cancellations and refunds work for orders placed with {s.shop_name} on this website.</>}
      sections={[
        {
          id: "policy",
          title: "Our policy",
          // written by the owner in Admin → Settings → Content (also shown on the Terms page)
          body: s.legal.refund_policy ? (
            <p className="whitespace-pre-line">{s.legal.refund_policy}</p>
          ) : (
            <p>
              <Blank label="Cancellation and refund policy: when customers can cancel, and how and when refunds are paid" />
            </p>
          ),
        },
        {
          id: "unpaid",
          title: "Unpaid online orders",
          body: <p>If an online UPI payment isn&rsquo;t completed within {s.hold_minutes} minutes, the order is released automatically and nothing is charged.</p>,
        },
        {
          id: "shop",
          title: "If we can't fulfil your order",
          body: <p>If we have to cancel an order, or part of it (for example, an item runs out), we&rsquo;ll contact you and refund what you paid for the items we can&rsquo;t supply, to the same UPI account you paid from.</p>,
        },
        {
          id: "contact",
          title: "How to ask",
          body: (
            <p>
              Use the <Link href="/contact" className="ink-link">contact page</Link> or WhatsApp us with your order code (for example, IM1001).
            </p>
          ),
        },
      ]}
    />
  );
}
