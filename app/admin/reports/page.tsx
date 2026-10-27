import { redirect } from "next/navigation";
import { Reports } from "@/components/admin/Reports";
import { getSessionProfile } from "@/lib/supabase/server";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { profile } = await getSessionProfile();
  if (profile?.role !== "owner") redirect("/admin");
  return <Reports />;
}
