import { describe, expect, it } from "vitest";
import { SEED_COMBOS, SEED_PRODUCTS } from "./catalog";
import { cartTotals, comboComponentValue, comboTotal, formatINR, priceForGrams } from "./pricing";
import { buildQuote, pickSlab } from "./delivery";
import type { DeliverySlab } from "./types";

describe("pricing", () => {
  it("pro-rates per-kg prices", () => {
    expect(priceForGrams(600, 250)).toBe(150);
    expect(priceForGrams(650, 250)).toBe(162.5);
    expect(priceForGrams(650, 500)).toBe(325);
    expect(priceForGrams(1200, 100)).toBe(120);
  });

  it("combo components add up to the printed combo subtotal", () => {
    for (const [i, expected] of [630, 1075, 1270].entries()) {
      const c = SEED_COMBOS[i];
      const sum = comboComponentValue(c, SEED_PRODUCTS).reduce((s, x) => s + x.amount, 0);
      expect(sum).toBe(expected);
      expect(c.price).toBe(expected);
    }
    expect(comboTotal(SEED_COMBOS[0])).toBe(650);
  });

  it("totals a mixed cart with packing on combos only", () => {
    const laddu = SEED_PRODUCTS.find((p) => p.slug === "laddu")!;
    const t = cartTotals(
      [
        { key: "a", type: "product", id: laddu.id, grams: 500, qty: 2 },
        { key: "b", type: "combo", id: SEED_COMBOS[0].id, qty: 1 },
      ],
      SEED_PRODUCTS,
      SEED_COMBOS,
    );
    expect(t.subtotal).toBe(600 + 630);
    expect(t.packing).toBe(20);
  });

  it("formats rupees", () => {
    expect(formatINR(1270)).toBe("₹1,270");
    expect(formatINR(162.5)).toBe("₹162.50");
  });
});

describe("delivery", () => {
  const slabs: DeliverySlab[] = [
    { id: "1", from_km: 0, to_km: 5, fee: 100, eta_label_en: "Same day", eta_label_ta: null, active: true },
    { id: "2", from_km: 5, to_km: 7, fee: 150, eta_label_en: "Same day", eta_label_ta: null, active: true },
    { id: "3", from_km: 7, to_km: null, fee: 300, eta_label_en: "3–5 days", eta_label_ta: null, active: true },
  ];
  const settings = { local_radius_km: 7, allowed_state: "Tamil Nadu" };

  it("picks slabs by half-open range", () => {
    expect(pickSlab(0, slabs)?.fee).toBe(100);
    expect(pickSlab(4.9, slabs)?.fee).toBe(100);
    expect(pickSlab(5, slabs)?.fee).toBe(150);
    expect(pickSlab(120, slabs)?.fee).toBe(300);
  });

  it("is local within the radius, inclusive", () => {
    const q = buildQuote({ distanceKm: 7, state: null, settings, slabs, approx: false });
    expect(q.kind).toBe("local");
  });

  it("couriers beyond the radius only inside Tamil Nadu, with the charge left to the shop", () => {
    const q = buildQuote({ distanceKm: 40, state: "Tamil Nadu", settings, slabs, approx: false });
    expect(q).toEqual({ kind: "courier", distance_km: 40, approx: false });
    // no slab is needed past the local radius
    expect(buildQuote({ distanceKm: 7.1, state: "Tamil Nadu", settings, slabs: [slabs[0]], approx: false }).kind).toBe("courier");
    expect(buildQuote({ distanceKm: 40, state: "Karnataka", settings, slabs, approx: false }).kind).toBe("rejected");
  });

  it("rejects when no slab covers the distance", () => {
    const q = buildQuote({ distanceKm: 3, state: "Tamil Nadu", settings, slabs: [slabs[2]], approx: false });
    expect(q).toMatchObject({ kind: "rejected", reason: "NO_RATE" });
  });
});
