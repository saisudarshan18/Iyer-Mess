import { after, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSessionProfile, supabaseService } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/server/security";
import { pushToStaff } from "@/lib/server/push";
import { sendTemplate, shopWhatsApp } from "@/lib/server/whatsapp";
import { sendEmail, shopForEmail } from "@/lib/email/send";
import { contactEmail } from "@/lib/email/templates";
import { validateMobile } from "@/lib/validate";

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/).optional().or(z.literal("")),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  topic: z.enum(["order", "bulk", "feedback", "other"]),
  order_code: z.string().trim().max(20).optional().or(z.literal("")),
  message: z.string().trim().min(5).max(2000),
  website: z.string().max(0).optional(), // honeypot: humans never fill this
});

const TOPIC = { order: "Order help", bulk: "Bulk / party order", feedback: "Feedback", other: "Other" } as const;

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  const limited = await rateLimit(`contact:${clientIp(req)}`, 5, 3600);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST", issues: parsed.error.issues.map((i) => i.path[0]) }, { status: 400 });
  const b = parsed.data;
  if (!b.phone && !b.email) return NextResponse.json({ error: "NEED_CONTACT", issues: ["phone", "email"] }, { status: 400 });
  if (b.phone && !validateMobile(b.phone).ok) return NextResponse.json({ error: "BAD_PHONE", issues: ["phone"] }, { status: 400 });

  const { user } = await getSessionProfile();
  const sb = supabaseService();
  const { data: msg, error } = await sb
    .from("contact_messages")
    .insert({ user_id: user?.id ?? null, name: b.name, phone: b.phone || null, email: b.email || null, topic: b.topic, order_code: b.order_code || null, message: b.message })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "generic" }, { status: 500 });

  after(async () => {
    await pushToStaff({ title: `New message · ${TOPIC[b.topic]}`, body: `${b.name}: ${b.message.slice(0, 120)}`, url: "/admin/messages", tag: `msg-${msg.id}`, kind: "staff" }).catch(() => {});
    const shop = shopWhatsApp();
    if (shop) {
      await sendTemplate({ to: shop, name: "shop_new_message", body: [b.name, b.phone ? `+91 ${b.phone}` : b.email || "-", `${TOPIC[b.topic]}: ${b.message.slice(0, 300)}`] }).catch((e) =>
        console.error("shop whatsapp failed", e),
      );
    }
    const { data: s } = await sb.from("settings").select("support_email").eq("id", 1).single();
    const to = s?.support_email || process.env.SHOP_NOTIFY_EMAIL;
    if (to && process.env.RESEND_API_KEY) {
      await sendEmail(to, contactEmail(await shopForEmail(), { ...b, topic: TOPIC[b.topic] }), b.email ? { replyTo: b.email } : {}).catch((e) =>
        console.error("contact email failed", e),
      );
    }
  });
  return NextResponse.json({ ok: true });
}
