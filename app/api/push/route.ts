import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile, supabaseService } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/server/security";

const Sub = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(10).max(100) }),
});

/** Save this browser's push subscription for the signed-in user and turn push on. */
export async function POST(req: Request) {
  const { user } = await getSessionProfile();
  if (!user) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const limited = await rateLimit(`push:${user.id}`, 20, 600);
  if (limited) return limited;
  const parsed = Sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  const sb = supabaseService();
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await sb.from("profiles").update({ push_enabled: true }).eq("id", user.id);
  return NextResponse.json({ ok: true });
}

/** Forget this browser's subscription; turn push off when no devices are left. */
export async function DELETE(req: Request) {
  const { user } = await getSessionProfile();
  if (!user) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { endpoint?: string; all?: boolean };
  const sb = supabaseService();
  const q = sb.from("push_subscriptions").delete().eq("user_id", user.id);
  await (body.all || !body.endpoint ? q : q.eq("endpoint", body.endpoint));
  const { count } = await sb.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (!count || body.all) await sb.from("profiles").update({ push_enabled: false }).eq("id", user.id);
  return NextResponse.json({ ok: true });
}
