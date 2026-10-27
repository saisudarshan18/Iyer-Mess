import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/supabase/server";
import { notifyById } from "@/lib/server/orders";

/** Staff console calls this after a status change so the customer gets an email and push notification. */
export async function POST(req: Request) {
  const { profile } = await getSessionProfile();
  if (!profile || profile.role === "customer") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = z.object({ order_id: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  await notifyById(parsed.data.order_id);
  return NextResponse.json({ ok: true });
}
