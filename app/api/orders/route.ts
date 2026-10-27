import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile, supabaseService } from "@/lib/supabase/server";
import { quoteFor } from "@/lib/server/quote";
import { notifyById, orderError, startOnlinePayment } from "@/lib/server/orders";
import { TAKEAWAY_PAYMENTS } from "@/lib/delivery";
import { clientIp, rateLimit } from "@/lib/server/security";
import { AddressIn, OrderItems } from "@/lib/order-input";

const Body = z.object({
  items: OrderItems,
  mode: z.enum(["delivery", "takeaway"]),
  address: AddressIn.optional(),
  slot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  slot_id: z.string().uuid().optional(),
  payment_mode: z.enum(["cash", "upi_online", "upi_on_delivery"]),
  name: z.string().min(1).max(120),
  email: z.string().email().max(200).optional().or(z.literal("")),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const { user, profile } = await getSessionProfile();
  if (!user) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const limited = (await rateLimit(`orders:user:${user.id}`, 8, 600)) ?? (await rateLimit(`orders:ip:${clientIp(req)}`, 20, 600));
  if (limited) return limited;

  if (!profile?.phone) return NextResponse.json({ error: "PHONE_REQUIRED" }, { status: 428 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST", issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data;
  const sb = supabaseService();

  // release stale holds first so their stock is sellable again
  await sb.rpc("expire_holds");

  let fulfilment: "delivery_local" | "takeaway" = "takeaway";
  let delivery_fee = 0;
  let distance_km: number | null = null;
  let address: Record<string, unknown> | null = null;

  if (b.mode === "delivery") {
    if (!b.address) return NextResponse.json({ error: "ADDRESS_REQUIRED" }, { status: 400 });
    const quote = await quoteFor({ lat: b.address.lat, lng: b.address.lng });
    if (quote.kind === "rejected") return NextResponse.json({ error: quote.reason }, { status: 422 });
    // beyond the local radius the shop quotes the courier charge first: /api/courier-requests
    if (quote.kind === "courier") return NextResponse.json({ error: "COURIER_QUOTE_REQUIRED" }, { status: 422 });
    if (!quote.payments.includes(b.payment_mode)) return NextResponse.json({ error: "BAD_PAYMENT_MODE" }, { status: 422 });
    fulfilment = "delivery_local";
    delivery_fee = quote.fee;
    distance_km = quote.distance_km;
    address = { ...b.address, ...quote.geo };
  } else if (!TAKEAWAY_PAYMENTS.includes(b.payment_mode)) {
    return NextResponse.json({ error: "BAD_PAYMENT_MODE" }, { status: 422 });
  }

  const phone = profile.phone;
  const { data: order, error } = await sb.rpc("place_order", {
    p: {
      channel: "online",
      fulfilment,
      user_id: user.id,
      actor_id: user.id,
      customer_name: b.name,
      customer_phone: phone,
      customer_email: b.email || null,
      address,
      distance_km,
      delivery_fee,
      slot_date: b.slot_date ?? null,
      slot_id: b.slot_id ?? null,
      payment_mode: b.payment_mode,
      notes: b.notes ?? null,
      items: b.items,
    },
  });
  if (error) {
    const e = orderError(error.message);
    if (e.code === "generic") console.error("place_order failed", error);
    return NextResponse.json({ error: e.code, item: e.item }, { status: 409 });
  }

  // remember name/email for next time
  await sb.from("profiles").update({ name: b.name, ...(b.email ? { email: b.email } : {}) }).eq("id", user.id);

  if (b.payment_mode === "upi_online") {
    const pay = await startOnlinePayment(order, { name: b.name, phone, email: b.email ?? "" });
    return NextResponse.json(pay.body, { status: pay.status });
  }

  after(() => notifyById(order.id, { newOrder: true }));
  return NextResponse.json({ order: { id: order.id, short_code: order.short_code, total: Number(order.total) } });
}
