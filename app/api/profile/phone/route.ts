import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCode } from "@/lib/phone";
import { validateMobile, validateName } from "@/lib/validate";
import { getSessionProfile, supabaseService } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/server/security";

const Body = z.object({
  phone: z.string().max(20),
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().regex(/^\d{6}$/).optional(), // mobile-change codes are ours (lib/phone.ts makeCode), always 6
});

/**
 * Save the account's mobile number.
 * First time (no number yet): saved straight away. Changing it later: needs the code
 * emailed by /api/profile/phone/code for exactly this number.
 */
export async function POST(req: Request) {
  const { user, profile } = await getSessionProfile();
  if (!user || !profile) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  if (!process.env.OTP_PEPPER) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  const limited = await rateLimit(`phone-save:${user.id}`, 15, 600);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  const mobile = validateMobile(parsed.data.phone);
  if (!mobile.ok) return NextResponse.json({ error: "BAD_PHONE", reason: mobile.reason }, { status: 400 });
  const phone = mobile.e164;
  let name: string | undefined;
  if (parsed.data.name !== undefined) {
    const n = validateName(parsed.data.name);
    if (!n.ok) return NextResponse.json({ error: "BAD_NAME", reason: `NAME_${n.reason}` }, { status: 400 });
    name = n.clean;
  }
  // first time a number is set, a valid name is required too
  if (!profile.phone && !name && !profile.name) return NextResponse.json({ error: "BAD_NAME", reason: "NAME_SHORT" }, { status: 400 });

  const sb = supabaseService();
  if (profile.phone) {
    if (profile.phone === phone) return NextResponse.json({ ok: true, phone });
    if (!parsed.data.code) return NextResponse.json({ error: "CODE_REQUIRED" }, { status: 400 });
    const { data: row } = await sb.from("phone_change_codes").select("*").eq("user_id", user.id).is("used_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const verdict = checkCode(row, parsed.data.code, user.id, phone, process.env.OTP_PEPPER);
    if (!verdict.ok) {
      if (verdict.reason === "BAD_CODE" && row) await sb.from("phone_change_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return NextResponse.json({ error: verdict.reason, left: "left" in verdict ? verdict.left : undefined }, { status: 400 });
    }
    await sb.from("phone_change_codes").update({ used_at: new Date().toISOString() }).eq("id", row!.id);
  }

  const { error } = await sb
    .from("profiles")
    .update({ phone, ...(name ? { name } : {}) })
    .eq("id", user.id);
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "PHONE_TAKEN" }, { status: 409 });
    console.error("phone save failed", error);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, phone });
}
