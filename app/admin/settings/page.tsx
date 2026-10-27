import { redirect } from "next/navigation";
import { SettingsPanel } from "@/components/admin/SettingsPanel";
import { getSessionProfile } from "@/lib/supabase/server";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile } = await getSessionProfile();
  if (profile?.role !== "owner") redirect("/admin");
  return <SettingsPanel />;
}
