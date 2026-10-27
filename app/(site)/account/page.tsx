import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountClient } from "@/components/account/AccountClient";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSessionProfile } from "@/lib/supabase/server";
import type { PaymentMode, SavedAddress } from "@/lib/types";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default async function AccountPage() {
  if (!isSupabaseConfigured()) redirect("/login");
  const { sb, user } = await getSessionProfile();
  if (!user) redirect("/login?next=/account");
  const [{ data: profile }, { data: addresses }] = await Promise.all([
    sb.from("profiles").select("id, name, email, phone, preferred_payment, whatsapp_updates").eq("id", user.id).single(),
    sb.from("addresses").select("*").eq("user_id", user.id).order("created_at"),
  ]);
  return (
    <AccountClient
      profile={{ id: user.id, name: profile?.name ?? null, email: profile?.email ?? null, phone: profile?.phone ?? user.phone ?? null, preferred_payment: (profile?.preferred_payment as PaymentMode | null) ?? null, whatsapp_updates: profile?.whatsapp_updates ?? true }}
      addresses={(addresses ?? []) as SavedAddress[]}
      methods={(user.identities ?? []).map((i) => ({ provider: i.provider, email: (i.identity_data?.email as string | undefined) ?? null }))}
    />
  );
}
