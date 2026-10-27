import "server-only";
import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { supabaseService } from "@/lib/supabase/server";
import type { Shop } from "./layout";
import type { Email } from "./templates";

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "Iyer Mess <info@svcloudkitchen.com>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://iyermess.svcloudkitchen.com";

/** Shop details for the email footer (address, phone, WhatsApp). */
export async function shopForEmail(): Promise<Shop> {
  try {
    const { data } = await supabaseService().from("settings").select("shop_name, shop_address, shop_phone, whatsapp_number").eq("id", 1).single();
    return { name: data?.shop_name ?? "Iyer Mess", address: data?.shop_address ?? null, phone: data?.shop_phone ?? null, whatsapp: data?.whatsapp_number ?? data?.shop_phone ?? null, site: SITE };
  } catch {
    return { name: "Iyer Mess", address: null, phone: null, whatsapp: null, site: SITE };
  }
}

/** Send through Resend from info@svcloudkitchen.com. Throws on failure so callers decide. */
export async function sendEmail(to: string | string[], email: Email, opts: { replyTo?: string } = {}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const { error } = await new Resend(key).emails.send({
    from: EMAIL_FROM,
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: opts.replyTo ?? EMAIL_FROM.match(/<(.+)>/)?.[1],
    // unique per message, so Gmail doesn't fold separate codes/updates into one thread
    headers: { "X-Entity-Ref-ID": randomUUID() },
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}
