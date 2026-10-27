"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ProductArt } from "@/components/art/SweetGlyph";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatINR, formatWeight, priceForGrams } from "@/lib/pricing";
import type { Combo, Product } from "@/lib/types";
import { rpcMessage, useToast } from "./AdminShell";
import { buildableOf, kg, useCatalog } from "./useCatalog";

type Line = { key: string; product?: Product; combo?: Combo; grams?: number; qty: number };

/** Counter billing. Big touch targets; stock is deducted the moment the sale is charged. */
export function Pos() {
  const sb = supabaseBrowser()!;
  const toast = useToast();
  const { products, combos, stock, loading } = useCatalog();
  const [lines, setLines] = useState<Line[]>([]);
  const [picking, setPicking] = useState<Product | null>(null);
  const [pay, setPay] = useState<"cash" | "upi_counter">("cash");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [tendered, setTendered] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"sweet" | "savory" | "combo">("sweet");

  const lineTotal = (l: Line) => (l.product ? priceForGrams(l.product.price_per_kg, l.grams!) * l.qty : (l.combo!.price + l.combo!.packing_charge) * l.qty);
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);

  const add = (l: Omit<Line, "key" | "qty">) => {
    const key = l.product ? `p${l.product.id}:${l.grams}` : `c${l.combo!.id}`;
    setLines((ls) => (ls.some((x) => x.key === key) ? ls.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x)) : [...ls, { ...l, key, qty: 1 }]));
  };

  const charge = async () => {
    setBusy(true);
    const { data, error } = await sb.rpc("place_order", {
      p: {
        channel: "walkin",
        fulfilment: "counter",
        payment_mode: pay,
        customer_name: name || null,
        customer_phone: phone ? "91" + phone.replace(/\D/g, "").slice(-10) : null,
        items: lines.map((l) => (l.product ? { type: "product", id: l.product.id, grams: l.grams, qty: l.qty } : { type: "combo", id: l.combo!.id, qty: l.qty })),
      },
    });
    setBusy(false);
    if (error) return toast(rpcMessage(error.message), "err");
    toast(`Sale ${data.short_code} · ${formatINR(Number(data.total))}`);
    window.open(`/admin/receipt/${data.id}?auto=1`, "_blank", "width=420,height=720");
    setLines([]);
    setName("");
    setPhone("");
    setTendered("");
  };

  const shown = tab === "combo" ? [] : products.filter((p) => p.active && p.category === tab);
  const change = Number(tendered) - total;

  return (
    <div className="grid gap-6 md:grid-cols-12">
      <div className="md:col-span-7 lg:col-span-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h1 className="display text-5xl">Walk-in</h1>
          <div className="flex gap-2">
            {(["sweet", "savory", "combo"] as const).map((k) => (
              <button key={k} className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>
                {k === "sweet" ? "Sweets" : k === "savory" ? "Savories" : "Combos"}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-40" />)}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((p) => {
              const g = stock[p.id] ?? 0;
              return (
                <motion.button
                  key={p.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setPicking(p)}
                  disabled={g <= 0}
                  className="flex flex-col items-start rounded-2xl bg-paper-2 p-4 text-left transition-colors hover:bg-paper-3 disabled:opacity-40"
                >
                  <ProductArt slug={p.slug} image={p.image} alt="" className="h-16 w-16" />
                  <span className="mt-2 font-medium leading-tight">{p.name_en}</span>
                  <span className="tamil text-xs text-ink-soft">{p.name_ta}</span>
                  <span className="mt-auto flex w-full justify-between pt-2 text-xs">
                    <span className="price">{formatINR(p.price_per_kg)}/kg</span>
                    <span className={`lnum ${g <= p.low_stock_g ? "text-kumkum" : "text-ink-mute"}`}>{kg(g)} kg</span>
                  </span>
                </motion.button>
              );
            })}
            {tab === "combo" &&
              combos
                .filter((c) => c.active)
                .map((c) => {
                  const avail = c.boxed_stock + buildableOf(c, stock);
                  return (
                    <motion.button
                      key={c.id}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => add({ combo: c })}
                      disabled={avail <= 0}
                      className="flex flex-col items-start rounded-2xl bg-maroon p-4 text-left text-paper disabled:opacity-40"
                    >
                      <span className="display text-4xl">{c.slug.replace("combo-", "")}</span>
                      <span className="mt-1 font-medium">{c.name_en}</span>
                      <span className="mt-auto flex w-full justify-between pt-3 text-xs">
                        <span className="price">{formatINR(c.price + c.packing_charge)}</span>
                        <span className="lnum opacity-80">
                          {c.boxed_stock} boxed · {avail} total
                        </span>
                      </span>
                    </motion.button>
                  );
                })}
          </div>
        )}
      </div>

      {/* ticket */}
      {/* phones: the ticket sits below the products, so keep a shortcut to it in reach */}
      {lines.length > 0 && (
        <a
          href="#ticket"
          className="fixed inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 flex min-h-12 items-center justify-between rounded-full bg-ink px-5 text-paper shadow-lg md:hidden"
        >
          <span>Ticket · {lines.length} item{lines.length === 1 ? "" : "s"}</span>
          <span className="price">{formatINR(total)}</span>
        </a>
      )}
      <aside id="ticket" className="scroll-mt-20 md:col-span-5 lg:col-span-4">
        <div className="sticky top-20 rounded-[24px] bg-[#fbf6ec] p-5 shadow-[0_24px_50px_-28px_rgba(42,26,18,.5)]">
          <p className="smallcaps text-ink-mute">Ticket</p>
          <ul className="mt-3 max-h-[40vh] space-y-2 overflow-auto">
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.li key={l.key} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">
                    {l.product ? l.product.name_en : l.combo!.name_en}
                    {l.grams ? <span className="text-ink-mute"> · {formatWeight(l.grams)}</span> : null}
                  </span>
                  <span className="inline-flex items-center rounded-full shadow-[inset_0_0_0_1px_var(--rule)]">
                    <button className="h-8 w-8" onClick={() => setLines((ls) => ls.flatMap((x) => (x.key === l.key ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])))} aria-label="Less">
                      −
                    </button>
                    <span className="lnum w-6 text-center">{l.qty}</span>
                    <button className="h-8 w-8" onClick={() => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, qty: x.qty + 1 } : x)))} aria-label="More">
                      +
                    </button>
                  </span>
                  <span className="price w-20 text-right">{formatINR(lineTotal(l))}</span>
                </motion.li>
              ))}
            </AnimatePresence>
            {lines.length === 0 && <li className="py-6 text-center text-sm text-ink-mute">Tap items to add them</li>}
          </ul>

          <div className="mt-4 flex items-end justify-between border-t border-ink/60 pt-3">
            <span className="smallcaps">Total</span>
            <span className="display price text-4xl">{formatINR(total)}</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment">
            {(["cash", "upi_counter"] as const).map((m) => (
              <button key={m} role="radio" aria-checked={pay === m} onClick={() => setPay(m)} className={`rounded-2xl py-3 text-sm font-medium ${pay === m ? "bg-ink text-paper" : "shadow-[inset_0_0_0_1px_var(--rule)]"}`}>
                {m === "cash" ? "Cash" : "UPI"}
              </button>
            ))}
          </div>
          {pay === "cash" && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <input className="field !min-h-10 lnum" inputMode="numeric" placeholder="Cash received" value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^\d.]/g, ""))} />
              {tendered && <span className={`lnum shrink-0 ${change < 0 ? "text-kumkum" : "text-leaf"}`}>Change {formatINR(Math.max(0, change))}</span>}
            </div>
          )}
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-ink-soft">Customer (optional)</summary>
            <div className="mt-2 grid gap-2">
              <input className="field !min-h-10" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="field !min-h-10 lnum" placeholder="Mobile" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
            </div>
          </details>
          <button className="btn mt-4 w-full !min-h-14 !text-lg" disabled={!lines.length || busy} onClick={charge}>
            {busy ? "…" : `Charge ${formatINR(total)}`}
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {picking && (
          <WeighDialog
            product={picking}
            stockG={stock[picking.id] ?? 0}
            onClose={() => setPicking(null)}
            onPick={(grams) => {
              add({ product: picking, grams });
              setPicking(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Preset weights plus any custom weight (walk-ins are weighed at the counter). */
function WeighDialog({ product, stockG, onClose, onPick }: { product: Product; stockG: number; onClose: () => void; onPick: (g: number) => void }) {
  const [custom, setCustom] = useState("");
  const presets = [100, 200, 250, 500, 1000];
  const g = Math.round(Number(custom));
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-md rounded-3xl bg-paper p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4">
          <ProductArt slug={product.slug} image={product.image} alt="" className="h-16 w-16" />
          <div>
            <p className="display text-3xl">{product.name_en}</p>
            <p className="lnum text-sm text-ink-soft">
              {formatINR(product.price_per_kg)}/kg · {kg(stockG)} kg in stock
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {presets.map((p) => (
            <button key={p} disabled={p > stockG} onClick={() => onPick(p)} className="rounded-2xl bg-paper-2 py-4 hover:bg-turmeric disabled:opacity-35">
              <span className="block">{formatWeight(p)}</span>
              <span className="price block text-xs text-ink-soft">{formatINR(priceForGrams(product.price_per_kg, p))}</span>
            </button>
          ))}
        </div>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (g > 0 && g <= stockG) onPick(g);
          }}
        >
          <input className="field lnum" inputMode="numeric" placeholder="Custom grams" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))} autoFocus />
          <button className="btn shrink-0" disabled={!(g > 0 && g <= stockG)}>
            Add {g > 0 ? formatINR(priceForGrams(product.price_per_kg, g)) : ""}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
