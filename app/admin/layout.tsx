import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSessionProfile } from "@/lib/supabase/server";
import { normaliseSettings } from "@/lib/data";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Iyer Mess" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="grid min-h-screen place-items-center p-8 text-center">
        <p className="max-w-md text-ink-soft">Connect Supabase (see README) to use the admin console.</p>
      </div>
    );
  }
  const { sb, user, profile } = await getSessionProfile();
  if (!user) redirect("/login?next=/admin");
  if (profile && !profile.phone) redirect("/welcome?next=/admin");
  if (!profile || profile.role === "customer") {
    return (
      <div className="grid min-h-screen place-items-center p-8 text-center">
        <div>
          <p className="display text-4xl">Staff only</p>
          <p className="mt-3 text-ink-soft">Ask the owner to add your email ({profile?.email ?? user.email}) as staff.</p>
          <Link href="/" className="btn mt-6">
            Back to the shop
          </Link>
        </div>
      </div>
    );
  }
  const { data: settings } = await sb.from("settings").select("*").eq("id", 1).single();
  return (
    <AdminShell role={profile.role} name={profile.name ?? profile.phone ?? "Staff"} settings={normaliseSettings(settings!)}>
      {children}
    </AdminShell>
  );
}
