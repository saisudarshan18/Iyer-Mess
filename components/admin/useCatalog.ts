"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Combo, Product } from "@/lib/types";

export type AdminCatalog = {
  products: Product[];
  combos: Combo[];
  stock: Record<string, number>; // product id → grams
  loading: boolean;
  reload: () => Promise<void>;
};

/** Products (incl. inactive), combos with their items, and live stock. */
export function useCatalog(): AdminCatalog {
  const sb = supabaseBrowser()!;
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [p, c, ci, inv] = await Promise.all([
      sb.from("products").select("*").order("sort"),
      sb.from("combos").select("*").order("sort"),
      sb.from("combo_items").select("*"),
      sb.from("inventory").select("product_id, stock_g"),
    ]);
    setProducts((p.data ?? []).map((x) => ({ ...x, price_per_kg: Number(x.price_per_kg) })));
    setCombos(
      (c.data ?? []).map((x) => ({
        ...x,
        price: Number(x.price),
        packing_charge: Number(x.packing_charge),
        items: (ci.data ?? []).filter((i) => i.combo_id === x.id).map(({ product_id, grams }) => ({ product_id, grams })),
      })),
    );
    setStock(Object.fromEntries((inv.data ?? []).map((r) => [r.product_id, r.stock_g])));
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    reload();
    const ch = sb
      .channel("admin-stock")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "inventory" }, ({ new: r }) => setStock((s) => ({ ...s, [r.product_id]: r.stock_g })))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "combos" }, ({ new: r }) =>
        setCombos((list) => list.map((c) => (c.id === r.id ? { ...c, boxed_stock: r.boxed_stock } : c))),
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [sb, reload]);

  return { products, combos, stock, loading, reload };
}

export const buildableOf = (c: Combo, stock: Record<string, number>) =>
  c.items.length ? Math.min(...c.items.map((i) => Math.floor((stock[i.product_id] ?? 0) / i.grams))) : 0;

export const kg = (g: number) => (g / 1000).toLocaleString("en-IN", { maximumFractionDigits: 3 });
