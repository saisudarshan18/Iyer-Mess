import type { DeliverySlab, PaymentMode, Settings } from "./types";

export type QuoteKind = "local" | "courier" | "rejected";

export type Quote =
  | {
      kind: "local";
      distance_km: number;
      fee: number;
      eta_en: string;
      eta_ta: string | null;
      payments: PaymentMode[];
      approx: boolean;
    }
  // the courier company's charge depends on the parcel, so the shop quotes it by hand (courier_requests)
  | { kind: "courier"; distance_km: number; approx: boolean }
  | { kind: "rejected"; reason: "OUT_OF_STATE" | "NO_RATE" | "SHOP_NOT_SET" | "UNVERIFIED_STATE"; distance_km?: number };

export const LOCAL_PAYMENTS: PaymentMode[] = ["cash", "upi_on_delivery", "upi_online"];
export const TAKEAWAY_PAYMENTS: PaymentMode[] = ["cash", "upi_on_delivery", "upi_online"];

/** Slab whose [from_km, to_km) range holds the distance; to_km null means no upper bound. */
export function pickSlab(distanceKm: number, slabs: DeliverySlab[]): DeliverySlab | null {
  const active = slabs.filter((s) => s.active).sort((a, b) => a.from_km - b.from_km);
  return (
    active.find((s) => distanceKm >= s.from_km && (s.to_km === null || distanceKm < s.to_km)) ??
    // the very last km boundary is inclusive (e.g. exactly 7.0 km in a 5–7 slab)
    active.find((s) => s.to_km !== null && distanceKm === s.to_km && !active.some((o) => o.from_km === s.to_km)) ??
    null
  );
}

export function buildQuote(args: {
  distanceKm: number;
  state: string | null;
  settings: Pick<Settings, "local_radius_km" | "allowed_state">;
  slabs: DeliverySlab[];
  approx: boolean;
}): Quote {
  const d = Math.round(args.distanceKm * 10) / 10;
  if (d > args.settings.local_radius_km) {
    if (!args.state) return { kind: "rejected", reason: "UNVERIFIED_STATE", distance_km: d };
    if (normalise(args.state) !== normalise(args.settings.allowed_state))
      return { kind: "rejected", reason: "OUT_OF_STATE", distance_km: d };
    return { kind: "courier", distance_km: d, approx: args.approx };
  }
  const slab = pickSlab(d, args.slabs);
  if (!slab) return { kind: "rejected", reason: "NO_RATE", distance_km: d };
  return {
    kind: "local",
    distance_km: d,
    fee: slab.fee,
    eta_en: slab.eta_label_en,
    eta_ta: slab.eta_label_ta,
    payments: LOCAL_PAYMENTS,
    approx: args.approx,
  };
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** Great-circle distance; used only when no Google server key is configured. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
