import { NextResponse } from "next/server";
import { sendEmail, shopForEmail } from "@/lib/email/send";
import { codeEmail, type CodeKind } from "@/lib/email/templates";
import { rateLimit } from "@/lib/server/security";
import { verifyStandardWebhook } from "@/lib/server/webhook";
import { OTP_LENGTH } from "@/lib/auth";

type HookPayload = {
  user: { email?: string; new_email?: string };
  email_data: { token: string; token_new?: string; email_action_type: string };
};

const KIND: Record<string, CodeKind> = {
  signup: "signup",
  invite: "signup",
  magiclink: "login",
  recovery: "login",
  reauthentication: "reauth",
  email_change: "email_change",
};

/**
 * Supabase Auth → Hooks → "Send Email" (HTTPS) → https://<site>/api/auth/email-hook
 * Supabase creates the 6-digit code; we send it in our own design from info@svcloudkitchen.com.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const check = verifyStandardWebhook(req, raw, process.env.SUPABASE_EMAIL_HOOK_SECRET);
  if (!check.ok) return hookError(check.reason, 401);

  const { user, email_data: d } = JSON.parse(raw) as HookPayload;
  const kind = KIND[d.email_action_type];
  // Supabase's "Email OTP Length" must match the 6 boxes on the login page
  if (d.token && d.token.length !== OTP_LENGTH) console.warn(`Supabase sent a ${d.token.length}-digit code; set Email OTP Length to ${OTP_LENGTH} in Supabase → Auth → Providers → Email`);
  if (!kind) return hookError(`Unsupported email type ${d.email_action_type}`, 400);

  // with secure email change Supabase sends one code to each address
  const sends: [string, string][] = [];
  if (kind === "email_change") {
    if (user.email && d.token) sends.push([user.email, d.token]);
    if (user.new_email && d.token_new) sends.push([user.new_email, d.token_new]);
  } else if (user.email) {
    sends.push([user.email, d.token]);
  }
  if (!sends.length) return hookError("No recipient", 400);

  for (const [to] of sends) {
    if (await rateLimit(`email-code:${to.toLowerCase()}`, 5, 3600)) return hookError("Too many codes requested. Try again in an hour.", 429);
  }
  try {
    const shop = await shopForEmail();
    await Promise.all(sends.map(([to, code]) => sendEmail(to, codeEmail(shop, code, kind, to))));
  } catch (e) {
    console.error("auth email failed", e);
    return hookError("Could not send the email", 500);
  }
  return NextResponse.json({});
}

const hookError = (message: string, status: number) => NextResponse.json({ error: { http_code: status, message } }, { status });
