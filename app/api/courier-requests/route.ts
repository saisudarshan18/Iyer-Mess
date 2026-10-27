import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile, supabaseService } from "@/lib/supabase/server";
import { normaliseCourierRequest, notifyStaffCourierRequest, priceCart } from "@/lib/server/courier";
import { quoteFor } from "@/lib/server/quote";
import { clientIp, rateLimit } from "@/lib/server/security";
import { AddressIn, OrderItems } from "@/lib/order-input";

const Body = z.object({
  items: OrderItems,
  address: AddressIn,
  name: z.string().min(1).max(120),
  email: z.string().email().max(200).optional().or(z.literal("")),
  notes: z.string().max(500).optional(),
});

/** Beyond the local radius: ask the shop to weigh the parcel and quote the courier charge. Nothing is charged or reserved yet. */
export async function POST(req: Request) {
  const { user, profile } = await getSessionProfile();
  if (!user) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const limited = (await rateLimit(`courier:user:${user.id}`, 6, 600)) ?? (await rateLimit(`courier:ip:${clientIp(req)}`, 20, 600));
  if (limited) return limited;
  if (!profile?.phone) return NextResponse.json({ error: "PHONE_REQUIRED" }, { status: 428 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST", issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data;
  const sb = supabaseService();

  const { data: s } = await sb.from("settings").select("orders_open").eq("id", 1).single();
  if (!s?.orders_open) return NextResponse.json({ error: "ORDERS_CLOSED" }, { status: 409 });

  const quote = await quoteFor({ lat: b.address.lat, lng: b.address.lng });
  if (quote.kind === "rejected") return NextResponse.json({ error: quote.reason }, { status: 422 });
  if (quote.kind !== "courier") return NextResponse.json({ error: "LOCAL_DELIVERY" }, { status: 422 });

  const priced = await priceCart(b.items);
  if (!priced) return NextResponse.json({ error: "ITEM_UNAVAILABLE" }, { status: 409 });

  const { data, error } = await sb
    .from("courier_requests")
    .insert({
      user_id: user.id,
      customer_name: b.name,
      customer_phone: profile.phone,
      customer_email: b.email || null,
      items: b.items,
      address: { ...b.address, ...quote.geo },
      distance_km: quote.distance_km,
      weight_g: priced.weight_g,
      subtotal: priced.subtotal,
      packing: priced.packing,
      notes: b.notes ?? null,
    })
    .select("*")
    .single();
  if (error) {
    console.error("courier request failed", error);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
  await sb.from("profiles").update({ name: b.name, ...(b.email ? { email: b.email } : {}) }).eq("id", user.id);

  const r = normaliseCourierRequest(data);
  after(() => notifyStaffCourierRequest(r));
  return NextResponse.json({ request: { id: r.id, short_code: r.short_code } });
}
