import "server-only";
import { createHmac } from "node:crypto";
import { safeEqual } from "./razorpay";

/**
 * Verifies a Standard Webhooks signature (used by Supabase Auth hooks).
 * `secret` is the "v1,whsec_<base64>" value Supabase shows when you create the hook.
 */
export function verifyStandardWebhook(req: Request, raw: string, secret: string | undefined): { ok: true } | { ok: false; reason: string } {
  const key = secret?.replace(/^v1,whsec_/, "");
  const id = req.headers.get("webhook-id");
  const ts = req.headers.get("webhook-timestamp");
  const sigs = req.headers.get("webhook-signature") ?? "";
  if (!key || !id || !ts) return { ok: false, reason: "Unauthorized" };
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return { ok: false, reason: "Stale request" };
  const expected = createHmac("sha256", Buffer.from(key, "base64")).update(`${id}.${ts}.${raw}`).digest("base64");
  return sigs.split(" ").some((s) => safeEqual(s.replace(/^v1,/, ""), expected)) ? { ok: true } : { ok: false, reason: "Bad signature" };
}
