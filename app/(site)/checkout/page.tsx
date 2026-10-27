import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSessionProfile } from "@/lib/supabase/server";
import type { PaymentMode, SavedAddress } from "@/lib/types";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  if (!isSupabaseConfigured()) redirect("/login?next=/checkout");
  const { sb, user, profile } = await getSessionProfile();
  if (!user) redirect("/login?next=/checkout");
  const [{ data: addresses }, { data: prefs }] = await Promise.all([
    sb.from("addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at"),
    sb.from("profiles").select("preferred_payment").eq("id", user.id).single(),
  ]);
  return (
    <CheckoutClient
      nonce={(await headers()).get("x-nonce") ?? undefined}
      userId={user.id}
      saved={(addresses ?? []) as SavedAddress[]}
      preferred={(prefs?.preferred_payment as PaymentMode | null) ?? null}
      defaults={{ name: profile?.name ?? "", email: profile?.email ?? user.email ?? "", phone: profile?.phone ?? user.phone ?? "" }}
    />
  );
}
