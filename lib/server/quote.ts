import "server-only";
import { buildQuote, haversineKm, type Quote } from "@/lib/delivery";
import { normaliseSettings, normaliseSlab } from "@/lib/data";
import { supabaseService } from "@/lib/supabase/server";
import { reverseGeocode, roadDistanceKm } from "./google";

export type ServerQuote = Quote & { geo: { state: string | null; district: string | null; pincode: string | null } };

/**
 * Prices delivery to a point. Always computed on the server from the shop
 * location and the admin's slabs; the client's numbers are never trusted.
 * Without a Google server key it falls back to straight-line distance, and
 * can't verify the state, so courier orders are refused (local still works).
 */
export async function quoteFor(dest: { lat: number; lng: number }): Promise<ServerQuote> {
  const sb = supabaseService();
  const [{ data: s, error: e1 }, { data: slabs, error: e2 }] = await Promise.all([
    sb.from("settings").select("*").eq("id", 1).single(),
    sb.from("delivery_slabs").select("*").eq("active", true),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  const settings = normaliseSettings(s);
  const empty = { state: null, district: null, pincode: null };
  if (settings.shop_lat === null || settings.shop_lng === null) return { kind: "rejected", reason: "SHOP_NOT_SET", geo: empty };

  const shop = { lat: settings.shop_lat, lng: settings.shop_lng };
  const [road, geo] = await Promise.all([roadDistanceKm(shop, dest), reverseGeocode(dest)]);
  const distanceKm = road ?? haversineKm(shop, dest);

  const quote = buildQuote({
    distanceKm,
    state: geo?.state ?? null,
    settings,
    slabs: (slabs ?? []).map(normaliseSlab),
    approx: road === null,
  });
  return { ...quote, geo: geo ? { state: geo.state, district: geo.district, pincode: geo.pincode } : empty };
}
