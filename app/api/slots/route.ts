import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/server/security";

type Row = { slot_id: string; label: string; start_time: string; end_time: string; applies_to: string[]; remaining: number };

/** GET /api/slots?date=YYYY-MM-DD&kind=takeaway|delivery_local → slots with remaining capacity. */
export async function GET(req: Request) {
  const limited = await rateLimit(`slots:${clientIp(req)}`, 120, 60);
  if (limited) return limited;
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  const kind = url.searchParams.get("kind") ?? "takeaway";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "BAD_DATE" }, { status: 400 });

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("slot_availability", { p_date: date });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // hide slots that have already started today (shop time is IST)
  const now = new Date(Date.now() + 5.5 * 3600_000);
  const today = now.toISOString().slice(0, 10);
  const nowTime = now.toISOString().slice(11, 16);
  const slots = (data as Row[])
    .filter((s) => s.applies_to.includes(kind))
    .filter((s) => date !== today || s.start_time.slice(0, 5) > nowTime)
    .map((s) => ({ id: s.slot_id, label: s.label, start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5), remaining: Math.max(0, s.remaining) }));
  return NextResponse.json({ slots });
}
