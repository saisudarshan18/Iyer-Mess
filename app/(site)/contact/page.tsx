import { ContactSection } from "@/components/site/ContactForm";
import { VisitShop } from "@/components/site/VisitShop";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSessionProfile } from "@/lib/supabase/server";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Contact & support",
  description: "Call, WhatsApp or message Iyer Mess about an order, bulk orders for functions, or feedback. Directions to the shop.",
  path: "/contact",
});

export default async function ContactPage() {
  const profile = isSupabaseConfigured() ? (await getSessionProfile()).profile : null;
  return (
    <>
      <ContactSection defaults={{ name: profile?.name ?? "", phone: profile?.phone?.slice(-10) ?? "", email: profile?.email ?? "" }} />
      <VisitShop id="visit" />
    </>
  );
}
