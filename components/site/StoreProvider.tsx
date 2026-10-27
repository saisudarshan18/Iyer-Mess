"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Combo, Settings, StockMap, Storefront } from "@/lib/types";

type Store = Storefront & {
  /** grams in stock, or Infinity when no database is connected */
  stockOf: (productId: string) => number;
  /** boxes that can be sold right now (pre-packed + buildable from loose stock) */
  combosAvailable: (comboId: string) => number;
  boxedOf: (comboId: string) => number;
};

const Ctx = createContext<Store | null>(null);

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}

function buildable(combo: Combo, products: Record<string, number>) {
  if (!combo.items.length) return 0;
  return Math.min(...combo.items.map((it) => Math.floor((products[it.product_id] ?? 0) / it.grams)));
}

/** Seeds from the server render, then keeps stock and open/closed status live via Supabase Realtime. */
export function StoreProvider({ initial, children }: { initial: Storefront; children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [stock, setStock] = useState<StockMap | null>(initial.stock);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb || !initial.live) return;
    const channel = sb
      .channel("storefront")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "inventory" }, ({ new: row }) =>
        setStock((s) => (s ? { ...s, products: { ...s.products, [row.product_id]: row.stock_g } } : s)),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "combos" }, ({ new: row }) =>
        setStock((s) => (s ? { ...s, combos: { ...s.combos, [row.id]: { ...(s.combos[row.id] ?? { buildable: 0 }), boxed: row.boxed_stock } } } : s)),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, ({ new: row }) =>
        setSettings((s) => ({ ...s, ...(row as Partial<Settings>) })),
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [initial.live]);

  const value = useMemo<Store>(() => {
    const stockOf = (id: string) => (stock ? stock.products[id] ?? 0 : Infinity);
    const boxedOf = (id: string) => (stock ? stock.combos[id]?.boxed ?? 0 : Infinity);
    const combosAvailable = (id: string) => {
      if (!stock) return Infinity;
      const c = initial.combos.find((x) => x.id === id);
      return boxedOf(id) + (c ? buildable(c, stock.products) : 0);
    };
    return { ...initial, settings, stock, stockOf, boxedOf, combosAvailable };
  }, [initial, settings, stock]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
