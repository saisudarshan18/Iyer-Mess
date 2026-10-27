import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail, shopForEmail } from "@/lib/email/send";
import { phoneChangeEmail } from "@/lib/email/templates";
import { CODE_TTL_MS, hashCode, makeCode } from "@/lib/phone";
import { validateMobile } from "@/lib/validate";
import { getSessionProfile, supabaseService } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/server/security";

/** Email a 6-digit code that unlocks changing the account's mobile number to `phone`. */
export async function POST(req: Request) {
  const { user, profile } = await getSessionProfile();
  if (!user || !profile) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  if (!process.env.OTP_PEPPER) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  const parsed = z.object({ phone: z.string().max(20) }).safeParse(await req.json().catch(() => null));
  const mobile = parsed.success ? validateMobile(parsed.data.phone) : null;
  if (!mobile?.ok) return NextResponse.json({ error: "BAD_PHONE", reason: mobile && !mobile.ok ? mobile.reason : "FORMAT" }, { status: 400 });
  const phone = mobile.e164;
  if (!profile.phone) return NextResponse.json({ error: "NOT_NEEDED" }, { status: 400 });
  if (profile.phone === phone) return NextResponse.json({ error: "SAME_PHONE" }, { status: 400 });
  const email = user.email ?? profile.email;
  if (!email) return NextResponse.json({ error: "NO_EMAIL" }, { status: 400 });

  const limited = await rateLimit(`phone-code:${user.id}`, 5, 3600);
  if (limited) return limited;

  const sb = supabaseService();
  // don't email a code for a number that can't be used anyway
  const { data: taken } = await sb.from("profiles").select("id").like("phone", `%${phone.slice(-10)}`).neq("id", user.id).limit(1);
  if (taken?.length) return NextResponse.json({ error: "PHONE_TAKEN" }, { status: 409 });

  const code = makeCode();
  // only the newest code counts
  await sb.from("phone_change_codes").update({ used_at: new Date().toISOString() }).eq("user_id", user.id).is("used_at", null);
  const { error } = await sb.from("phone_change_codes").insert({
    user_id: user.id,
    new_phone: phone,
    code_hash: hashCode(code, user.id, phone, process.env.OTP_PEPPER),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) return NextResponse.json({ error: "generic" }, { status: 500 });

  try {
    await sendEmail(email, phoneChangeEmail(await shopForEmail(), code, phone));
  } catch (e) {
    console.error("phone code email failed", e);
    return NextResponse.json({ error: "EMAIL_FAILED" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sentTo: email.replace(/^(.).*(@.*)$/, "$1•••$2") });
}
