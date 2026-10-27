import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Google sign-in lands here: swap the one-time code for a session, then collect the mobile number if missing. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const raw = url.searchParams.get("next") ?? "/orders";
  // only same-site relative redirects
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/orders";
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}&next=${encodeURIComponent(next)}`, url.origin));

  if (url.searchParams.get("error")) return fail("google_cancelled");
  if (!code) return fail("missing_code");

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail("google_failed");

  const { data: profile } = await sb.from("profiles").select("phone").eq("id", data.user.id).single();
  const dest = profile?.phone ? next : `/welcome?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(dest, url.origin));
}
