import type { CartLine, Combo, Product } from "./types";

/** Price of `grams` of an item sold per kg, rounded to paise. Mirrors place_order() in SQL. */
export function priceForGrams(pricePerKg: number, grams: number): number {
  return Math.round(pricePerKg * grams * 100 / 1000) / 100;
}

export function comboTotal(c: Pick<Combo, "price" | "packing_charge">): number {
  return c.price + c.packing_charge;
}

/** Display value of a combo's component (for the receipt-style breakdown). */
export function comboComponentValue(c: Combo, products: Product[]) {
  return c.items.map((it) => {
    const p = products.find((x) => x.id === it.product_id);
    return { product: p, grams: it.grams, amount: p ? priceForGrams(p.price_per_kg, it.grams) : 0 };
  });
}

export function comboWeight(c: Combo): number {
  return c.items.reduce((s, it) => s + it.grams, 0);
}

export type CartTotals = { subtotal: number; packing: number; lines: { line: CartLine; amount: number; packing: number }[] };

export function cartTotals(lines: CartLine[], products: Product[], combos: Combo[]): CartTotals {
  let subtotal = 0;
  let packing = 0;
  const out: CartTotals["lines"] = [];
  for (const line of lines) {
    if (line.type === "product") {
      const p = products.find((x) => x.id === line.id);
      if (!p) continue;
      const amount = priceForGrams(p.price_per_kg, line.grams) * line.qty;
      subtotal += amount;
      out.push({ line, amount, packing: 0 });
    } else {
      const c = combos.find((x) => x.id === line.id);
      if (!c) continue;
      const amount = c.price * line.qty;
      const pk = c.packing_charge * line.qty;
      subtotal += amount;
      packing += pk;
      out.push({ line, amount, packing: pk });
    }
  }
  return { subtotal: round2(subtotal), packing: round2(packing), lines: out };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function formatINR(n: number): string {
  const hasPaise = Math.round(n * 100) % 100 !== 0;
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: hasPaise ? 2 : 0, maximumFractionDigits: 2 });
}

export function formatWeight(grams: number): string {
  if (grams >= 1000 && grams % 1000 === 0) return `${grams / 1000} kg`;
  if (grams === 250) return "¼ kg";
  if (grams === 500) return "½ kg";
  if (grams >= 1000) return `${(grams / 1000).toFixed(2).replace(/0+$/, "")} kg`;
  return `${grams} g`;
}
