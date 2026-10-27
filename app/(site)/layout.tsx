import { getStorefront } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSessionProfile } from "@/lib/supabase/server";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { Cursor } from "@/components/motion/Cursor";
import { StoreProvider } from "@/components/site/StoreProvider";
import { Header } from "@/components/site/Header";
import { CartDrawer } from "@/components/site/CartDrawer";
import { ClosedBanner } from "@/components/site/ClosedBanner";
import { Footer } from "@/components/site/Footer";
import { PushListener } from "@/components/site/PushListener";
import { WhatsAppButton } from "@/components/site/WhatsAppButton";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [storefront, session] = await Promise.all([
    getStorefront(),
    isSupabaseConfigured() ? getSessionProfile() : Promise.resolve({ profile: null }),
  ]);
  const meta = (session as { user?: { user_metadata?: Record<string, unknown> } | null }).user?.user_metadata;
  const viewer = session.profile
    ? {
        name: session.profile.name ?? ((meta?.full_name ?? meta?.name) as string | undefined) ?? null,
        email: session.profile.email,
        phone: session.profile.phone,
        role: session.profile.role,
      }
    : null;

  return (
    <StoreProvider initial={storefront}>
      <SmoothScroll>
        <Header viewer={viewer} />
        <main id="main">{children}</main>
        <Footer />
        <CartDrawer />
        <ClosedBanner />
        <WhatsAppButton />
        <PushListener />
        <Cursor />
      </SmoothScroll>
    </StoreProvider>
  );
}
