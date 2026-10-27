import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile, supabaseService } from "@/lib/supabase/server";
import { normaliseCourierRequest } from "@/lib/server/courier";
import { orderError, startOnlinePayment } from "@/lib/server/orders";
import { rateLimit } from "@/lib/server/security";

const Body = z.object({ action: z.enum(["accept", "decline"]) });

/**
 * The customer answers the shop's courier quote. Accepting places the order at the quoted
 * courier charge (stock is taken now, held for the payment window) and opens UPI checkout.
 * If that payment lapses, accepting again places a fresh order.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getSessionProfile();
  if (!user) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const limited = await rateLimit(`courier-accept:${user.id}`, 10, 600);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const sb = supabaseService();
  const { data: row } = await sb.from("courier_requests").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const r = normaliseCourierRequest(row);

  if (parsed.data.action === "decline") {
    if (r.status !== "quoted" && r.status !== "requested") return NextResponse.json({ error: "QUOTE_CLOSED" }, { status: 409 });
    await sb.from("courier_requests").update({ status: "declined", updated_at: new Date().toISOString() }).eq("id", r.id).in("status", ["requested", "quoted"]);
    return NextResponse.json({ ok: true });
  }

  await sb.rpc("expire_holds");
  const who = { name: r.customer_name, phone: profile?.phone ?? r.customer_phone, email: r.customer_email ?? "" };

  if (r.status === "accepted" && r.order_id) {
    const { data: prev } = await sb.from("orders").select("*").eq("id", r.order_id).single();
    if (prev?.payment_status === "paid" || (prev && prev.status !== "cancelled" && prev.status !== "pending_payment")) {
      return NextResponse.json({ order: { id: prev.id, short_code: prev.short_code, total: Number(prev.total) } });
    }
    // still inside the payment window: pay for the same order
    if (prev?.status === "pending_payment") {
      const pay = await startOnlinePayment(prev, who);
      return NextResponse.json(pay.body, { status: pay.status });
    }
  } else if (r.status !== "quoted" || r.courier_fee === null) {
    return NextResponse.json({ error: "QUOTE_NOT_READY" }, { status: 409 });
  }

  const { data: order, error } = await sb.rpc("place_order", {
    p: {
      channel: "online",
      fulfilment: "courier",
      user_id: user.id,
      actor_id: user.id,
      customer_name: r.customer_name,
      customer_phone: r.customer_phone,
      customer_email: r.customer_email,
      address: r.address,
      distance_km: r.distance_km,
      delivery_fee: r.courier_fee,
      payment_mode: "upi_online",
      notes: [r.notes, `Courier quote ${r.short_code}${r.courier_name ? ` · ${r.courier_name}` : ""}`].filter(Boolean).join("\n"),
      items: r.items,
    },
  });
  if (error) {
    const e = orderError(error.message);
    if (e.code === "generic") console.error("place_order (courier) failed", error);
    return NextResponse.json({ error: e.code, item: e.item }, { status: 409 });
  }

  // only one order per quote: if another tab got here first, cancel ours
  const { data: claimed } = await sb
    .from("courier_requests")
    .update({ status: "accepted", order_id: order.id, updated_at: new Date().toISOString() })
    .eq("id", r.id)
    .or(r.order_id ? `order_id.eq.${r.order_id}` : "order_id.is.null")
    .select("id");
  if (!claimed?.length) {
    await sb.rpc("cancel_order", { p_order: order.id, p_note: "Duplicate courier quote acceptance" });
    return NextResponse.json({ error: "QUOTE_CLOSED" }, { status: 409 });
  }

  const pay = await startOnlinePayment(order, who);
  return NextResponse.json(pay.body, { status: pay.status });
}
