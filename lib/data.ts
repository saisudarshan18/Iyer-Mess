import "server-only";
import { SEED_COMBOS, SEED_PRODUCTS, SEED_SETTINGS } from "./catalog";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./supabase/env";
import { supabaseServer } from "./supabase/server";
import type { Combo, DeliverySlab, Product, Settings, StockMap, Storefront } from "./types";

const num = (v: unknown) => (v === null || v === undefined ? v : Number(v)) as number;

export async function getStorefront(): Promise<Storefront> {
  if (!isSupabaseConfigured()) {
    return { products: SEED_PRODUCTS, combos: SEED_COMBOS, settings: SEED_SETTINGS, stock: null, live: false };
  }
  return loadStorefront(await supabaseServer());
}

/** Same data without the visitor's session: for share images and other cookie-less contexts. */
export async function getPublicStorefront(): Promise<Storefront> {
  if (!isSupabaseConfigured()) {
    return { products: SEED_PRODUCTS, combos: SEED_COMBOS, settings: SEED_SETTINGS, stock: null, live: false };
  }
  return loadStorefront(createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } }));
}

async function loadStorefront(sb: SupabaseClient): Promise<Storefront> {
  const [products, combos, items, inventory, avail, settings] = await Promise.all([
    sb.from("products").select("*").eq("active", true).order("sort"),
    sb.from("combos").select("*").eq("active", true).order("sort"),
    sb.from("combo_items").select("combo_id, product_id, grams"),
    sb.from("inventory").select("product_id, stock_g"),
    sb.from("combo_availability").select("combo_id, boxed_stock, buildable"),
    sb.from("settings").select("*").eq("id", 1).single(),
  ]);
  const err = products.error ?? combos.error ?? items.error ?? inventory.error ?? avail.error ?? settings.error;
  if (err) throw new Error(`storefront query failed: ${err.message}`);

  const stock: StockMap = { products: {}, combos: {} };
  for (const r of inventory.data!) stock.products[r.product_id] = r.stock_g;
  for (const r of avail.data!) stock.combos[r.combo_id] = { boxed: r.boxed_stock, buildable: r.buildable };

  return {
    products: products.data!.map(normaliseProduct),
    combos: combos.data!.map((c) => normaliseCombo(c, items.data!)),
    settings: normaliseSettings(settings.data),
    stock,
    live: true,
  };
}

export function normaliseProduct(p: Record<string, unknown>): Product {
  return { ...(p as unknown as Product), price_per_kg: num(p.price_per_kg) };
}

export function normaliseCombo(c: Record<string, unknown>, items: { combo_id: string; product_id: string; grams: number }[]): Combo {
  return {
    ...(c as unknown as Combo),
    price: num(c.price),
    packing_charge: num(c.packing_charge),
    items: items.filter((i) => i.combo_id === c.id).map(({ product_id, grams }) => ({ product_id, grams })),
  };
}

export function normaliseSettings(s: Record<string, unknown>): Settings {
  return { ...(s as unknown as Settings), local_radius_km: num(s.local_radius_km) };
}

export function normaliseSlab(s: Record<string, unknown>): DeliverySlab {
  return { ...(s as unknown as DeliverySlab), from_km: num(s.from_km), to_km: s.to_km === null ? null : num(s.to_km), fee: num(s.fee) };
}
