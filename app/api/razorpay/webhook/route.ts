import { after, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/server/razorpay";
import { notifyById } from "@/lib/server/orders";

type RazorpayEvent = {
  event: string;
  payload: { payment?: { entity: { id: string; order_id: string } }; order?: { entity: { id: string } } };
};

/**
 * Razorpay → Settings → Webhooks: point at /api/razorpay/webhook with events
 * payment.captured and order.paid. Confirms orders even if the customer closed
 * the tab before the checkout callback ran.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature") ?? "")) {
    return NextResponse.json({ error: "BAD_SIGNATURE" }, { status: 400 });
  }
  const event = JSON.parse(raw) as RazorpayEvent;
  if (event.event !== "payment.captured" && event.event !== "order.paid") return NextResponse.json({ ok: true });

  const payment = event.payload.payment?.entity;
  const rpOrderId = payment?.order_id ?? event.payload.order?.entity.id;
  if (!rpOrderId || !payment) return NextResponse.json({ ok: true });

  const sb = supabaseService();
  const { data: order } = await sb.from("orders").select("id, payment_status").eq("razorpay_order_id", rpOrderId).single();
  if (!order) return NextResponse.json({ ok: true });
  if (order.payment_status !== "paid") {
    const { error } = await sb.rpc("confirm_payment", { p_order: order.id, p_rp_order: rpOrderId, p_rp_payment: payment.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    after(() => notifyById(order.id, { newOrder: true }));
  }
  return NextResponse.json({ ok: true });
}
