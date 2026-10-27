import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/server/razorpay";

/** Meta's one-time check when the webhook is saved in the app dashboard. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === token) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

type StatusEvent = { id: string; status: string; recipient_id: string; errors?: { code: number; title: string }[] };

/**
 * Delivery receipts. We only log failures (e.g. the customer's number isn't on WhatsApp),
 * so they show up in the Vercel logs.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.WHATSAPP_APP_SECRET;
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  if (!secret || !safeEqual(`sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`, sig)) {
    return NextResponse.json({ error: "BAD_SIGNATURE" }, { status: 401 });
  }
  const body = JSON.parse(raw) as { entry?: { changes?: { value?: { statuses?: StatusEvent[] } }[] }[] };
  for (const e of body.entry ?? [])
    for (const c of e.changes ?? [])
      for (const s of c.value?.statuses ?? [])
        if (s.status === "failed") console.warn(`WhatsApp to ${s.recipient_id.slice(0, 4)}…${s.recipient_id.slice(-2)} failed:`, s.errors?.map((x) => `${x.code} ${x.title}`).join("; "));
  return NextResponse.json({ ok: true });
}
