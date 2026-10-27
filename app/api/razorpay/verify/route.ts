import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile, supabaseService } from "@/lib/supabase/server";
import { verifyCheckoutSignature } from "@/lib/server/razorpay";
import { notifyById } from "@/lib/server/orders";
import { rateLimit } from "@/lib/server/security";

const Body = z.object({
  order_id: z.string().uuid(),
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

/** Called by the browser right after Razorpay Checkout succeeds. The webhook is the backstop. */
export async function POST(req: Request) {
  const { user } = await getSessionProfile();
  if (!user) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const limited = await rateLimit(`verify:${user.id}`, 20, 600);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  const b = parsed.data;
  if (!verifyCheckoutSignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) {
    return NextResponse.json({ error: "BAD_SIGNATURE" }, { status: 400 });
  }

  const sb = supabaseService();
  const { data: owned } = await sb.from("orders").select("user_id").eq("id", b.order_id).single();
  if (owned?.user_id !== user.id) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const { error } = await sb.rpc("confirm_payment", {
    p_order: b.order_id,
    p_rp_order: b.razorpay_order_id,
    p_rp_payment: b.razorpay_payment_id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  after(() => notifyById(b.order_id, { newOrder: true }));
  return NextResponse.json({ ok: true });
}
