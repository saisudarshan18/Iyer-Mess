import "server-only";
import webpush from "web-push";
import { supabaseService } from "@/lib/supabase/server";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string; // same tag replaces the previous notification instead of stacking
  kind?: "order" | "staff";
};

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://iyermess.svcloudkitchen.com", pub, priv);
  configured = true;
  return true;
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

async function send(subs: Sub[], payload: PushPayload) {
  if (!configure() || !subs.length) return;
  const sb = supabaseService();
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 24, urgency: "high" });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id); // browser dropped the subscription
        else console.error("push failed", code, (e as Error).message);
      }
    }),
  );
  if (dead.length) await sb.from("push_subscriptions").delete().in("id", dead);
}

/** Every device the customer turned notifications on for. */
export async function pushToUser(userId: string, payload: PushPayload) {
  const sb = supabaseService();
  const { data: profile } = await sb.from("profiles").select("push_enabled").eq("id", userId).single();
  if (!profile?.push_enabled) return;
  const { data } = await sb.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  await send(data ?? [], payload);
}

/** Staff and owner devices, for new online orders. */
export async function pushToStaff(payload: PushPayload) {
  const sb = supabaseService();
  const { data: staff } = await sb.from("profiles").select("id").in("role", ["staff", "owner"]).eq("push_enabled", true);
  if (!staff?.length) return;
  const { data } = await sb.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", staff.map((s) => s.id));
  await send(data ?? [], payload);
}
