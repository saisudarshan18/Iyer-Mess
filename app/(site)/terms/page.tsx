import { Blank, LegalPage, businessLine } from "@/components/site/LegalPage";
import { getPublicStorefront } from "@/lib/data";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Terms & conditions", description: "Ordering, delivery, payment, cancellation and refund terms for Iyer Mess.", path: "/terms" });
export const revalidate = 3600;

export default async function TermsPage() {
  const { settings: s } = await getPublicStorefront();
  return (
    <LegalPage
      title="Terms & conditions"
      updated="October 2026"
      intro={<>These terms apply when you order from {s.shop_name} through this website. By placing an order you agree to them.</>}
      sections={[
        {
          id: "about",
          title: "About us",
          body: (
            <>
              <p>This shop is run by {businessLine(s)}.</p>
              <p>
                FSSAI licence no.: <Blank value={s.legal.fssai} label="FSSAI licence number" />
              </p>
            </>
          ),
        },
        {
          id: "account",
          title: "Your account",
          body: <p>You log in with your email (a one-time code we email you) or your Google account, and add a mobile number for delivery. Keep your email account secure; orders placed from your account are treated as yours. Please give accurate contact and delivery details.</p>,
        },
        {
          id: "products",
          title: "Products and prices",
          body: (
            <ul>
              <li>Loose sweets and savories are priced per kilogram and sold in the pack sizes shown. Combo boxes have a fixed price plus the packing charge shown.</li>
              <li>Prices shown at checkout are final for that order. Delivery charges are added separately and shown before you pay.</li>
              <li>Our sweets and savories are made in a kitchen that uses nuts (including cashew), dairy (ghee), gram flour, wheat, rice and sesame. If you have an allergy, contact us before ordering.</li>
              <li>Photos and illustrations are for guidance; handmade items vary slightly in size and shape.</li>
            </ul>
          ),
        },
        {
          id: "orders",
          title: "Orders and availability",
          body: <p>An order is accepted once you see the confirmation page (for online UPI payments, once payment is received). Items are subject to stock. If we can&rsquo;t fulfil an order or part of it, we&rsquo;ll contact you and refund any amount paid for what we can&rsquo;t supply.</p>,
        },
        {
          id: "delivery",
          title: "Delivery and pickup",
          body: (
            <ul>
              <li><b>Local delivery</b> (within {s.local_radius_km} km of the shop): delivered within a day, in the slot you choose.</li>
              <li><b>Courier</b> (beyond {s.local_radius_km} km, elsewhere in {s.allowed_state}): courier charges are as per the courier company. We weigh the parcel and quote the charge; the order is placed only after you approve and pay. Delivery time depends on distance and the courier; times shown are estimates.</li>
              <li><b>Takeaway</b>: collect from the shop in the slot you choose.</li>
              <li>Local delivery charges depend on distance and are shown at checkout. Please make sure someone can receive the order at the address and pin you give.</li>
            </ul>
          ),
        },
        {
          id: "payment",
          title: "Payment",
          body: (
            <ul>
              <li>Local delivery and takeaway: pay online by UPI, or cash/UPI when you receive the order.</li>
              <li>Courier orders: online UPI payment in advance only.</li>
              <li>Online payments are processed by Razorpay. If an online payment isn&rsquo;t completed within {s.hold_minutes} minutes, the order is released.</li>
            </ul>
          ),
        },
        {
          id: "refunds",
          title: "Cancellations and refunds",
          body: s.legal.refund_policy ? (
            <p className="whitespace-pre-line">{s.legal.refund_policy}</p>
          ) : (
            <p>
              <Blank label="Cancellation and refund policy: when customers can cancel, and how and when refunds are paid" />
            </p>
          ),
        },
        {
          id: "liability",
          title: "Our responsibility",
          body: <p>We take care to prepare, pack and deliver your order properly. If something is wrong with your order, contact us as soon as possible (photos help) and we&rsquo;ll make it right. Our liability for any order is limited to the amount you paid for it, except where the law says otherwise.</p>,
        },
        {
          id: "law",
          title: "Governing law and grievances",
          body: (
            <>
              <p>
                These terms are governed by the laws of India. Disputes are subject to the courts at <Blank value={s.legal.jurisdiction} label="City for jurisdiction" />.
              </p>
              <p>
                Grievance officer: <Blank value={s.legal.grievance_name} label="Grievance officer name" />, <Blank value={s.legal.grievance_email} label="Grievance officer email" />.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
