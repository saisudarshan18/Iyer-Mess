import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile, supabaseService } from "@/lib/supabase/server";
import { normaliseCourierRequest, notifyCustomerQuote } from "@/lib/server/courier";

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("quote"),
    fee: z.number().min(0).max(100000),
    courier_name: z.string().max(80).optional(),
    note: z.string().max(300).optional(),
  }),
  z.object({ action: z.literal("reject"), note: z.string().max(300).optional() }),
]);

/** Staff price a courier request after weighing it (or turn it down); the customer is told either way. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await getSessionProfile();
  if (!profile || profile.role === "customer") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  const b = parsed.data;

  const now = new Date().toISOString();
  const patch =
    b.action === "quote"
      ? { status: "quoted", courier_fee: Math.round(b.fee * 100) / 100, courier_name: b.courier_name?.trim() || null, shop_note: b.note?.trim() || null, quoted_at: now, updated_at: now }
      : { status: "rejected", shop_note: b.note?.trim() || null, updated_at: now };

  // a quote can be revised until the customer accepts it
  const { data, error } = await supabaseService().from("courier_requests").update(patch).eq("id", id).in("status", ["requested", "quoted"]).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "QUOTE_CLOSED" }, { status: 409 });

  const r = normaliseCourierRequest(data);
  after(() => notifyCustomerQuote(r));
  return NextResponse.json({ request: r });
}
