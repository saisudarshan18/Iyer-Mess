"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ProductArt } from "@/components/art/SweetGlyph";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Combo, Product } from "@/lib/types";
import { rpcMessage, useToast } from "./AdminShell";
import { buildableOf, kg, useCatalog } from "./useCatalog";

type Movement = { id: number; product_id: string | null; combo_id: string | null; delta: number; balance_after: number; reason: string; note: string | null; created_at: string };

export function Inventory() {
  const { products, combos, stock, loading } = useCatalog();
  const [query, setQuery] = useState("");
  const [moves, setMoves] = useState<Movement[]>([]);
  const sb = supabaseBrowser()!;

  useEffect(() => {
    sb.from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25)
      .then(({ data }) => setMoves(data ?? []));
    const ch = sb
      .channel("admin-moves")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stock_movements" }, ({ new: m }) => setMoves((l) => [m as Movement, ...l].slice(0, 25)))
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [sb]);

  const nameOf = (m: Movement) => products.find((p) => p.id === m.product_id)?.name_en ?? combos.find((c) => c.id === m.combo_id)?.name_en ?? "—";
  const shown = products.filter((p) => p.name_en.toLowerCase().includes(query.toLowerCase()) || p.name_ta.includes(query));

  return (
    <div className="grid gap-8 xl:grid-cols-12">
      <div className="xl:col-span-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="display text-5xl">Inventory</h1>
            <p className="text-sm text-ink-soft">Loose items are counted in kg. Sales deduct automatically; adjust here any time.</p>
          </div>
          <input className="field !w-64" placeholder="Search items" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <section>
          <h2 className="smallcaps mb-3 text-ink-mute">Loose stock</h2>
          {loading ? (
            <div className="skeleton h-96" />
          ) : (
            <ul className="divide-y divide-rule rounded-[22px] bg-paper-2/60">
              {shown.map((p) => (
                <ProductRow key={p.id} product={p} grams={stock[p.id] ?? 0} />
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="smallcaps mb-3 text-ink-mute">Combo boxes</h2>
          <p className="mb-3 text-sm text-ink-soft">Pre-packed boxes sell first; after that, combos are built from loose stock automatically.</p>
          <ul className="grid gap-3 md:grid-cols-3">
            {combos.map((c) => (
              <ComboRow key={c.id} combo={c} buildable={buildableOf(c, stock)} products={products} />
            ))}
          </ul>
        </section>
      </div>

      <aside className="xl:col-span-4">
        <div className="sticky top-24">
          <h2 className="smallcaps mb-3 text-ink-mute">Latest movements</h2>
          <ul className="space-y-1.5 text-sm">
            <AnimatePresence initial={false}>
              {moves.map((m) => (
                <motion.li key={m.id} layout initial={{ opacity: 0, x: 20, backgroundColor: "rgba(217,162,27,.35)" }} animate={{ opacity: 1, x: 0, backgroundColor: "rgba(0,0,0,0)" }} transition={{ duration: 1 }} className="flex items-center gap-3 rounded-xl px-3 py-2">
                  <span className={`lnum w-20 shrink-0 text-right ${m.delta < 0 ? "text-kumkum" : "text-leaf"}`}>
                    {m.delta > 0 ? "+" : ""}
                    {m.combo_id ? `${m.delta} box` : `${kg(m.delta)} kg`}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{nameOf(m)}</span>
                  <span className="shrink-0 text-xs text-ink-mute">{m.reason.replace(/_/g, " ")}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function ProductRow({ product: p, grams }: { product: Product; grams: number }) {
  const sb = supabaseBrowser()!;
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<"kg" | "g">("kg");
  const [busy, setBusy] = useState(false);
  const low = grams <= p.low_stock_g;
  const value = Math.round(Number(amount) * (unit === "kg" ? 1000 : 1));

  const apply = async (mode: "add" | "remove" | "set", g = value) => {
    if (!(g >= 0) || (mode !== "set" && g === 0)) return;
    setBusy(true);
    const { error } = await sb.rpc("adjust_stock", { p_product: p.id, p_combo: null, p_mode: mode, p_value: g, p_note: null });
    setBusy(false);
    if (error) return toast(rpcMessage(error.message), "err");
    setAmount("");
    toast(`${p.name_en}: ${mode} ${kg(g)} kg`);
  };

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${p.active ? "" : "opacity-50"}`}>
      <ProductArt slug={p.slug} image={p.image} alt="" className="h-10 w-10 shrink-0" />
      <div className="min-w-36 flex-1">
        <p className="font-medium">{p.name_en}</p>
        <p className="tamil text-xs text-ink-soft">{p.name_ta}</p>
      </div>
      <motion.p key={grams} initial={{ scale: 1.2, color: "#c2362b" }} animate={{ scale: 1, color: low ? "#c2362b" : "#2a1a12" }} className="lnum w-24 text-right text-lg">
        {kg(grams)} <span className="text-xs">kg</span>
      </motion.p>
      <div className="flex items-center gap-1">
        {[250, 1000].map((g) => (
          <button key={g} className="chip !min-h-9 !px-3 !text-xs" disabled={busy} onClick={() => apply("add", g)}>
            +{g === 1000 ? "1 kg" : "¼"}
          </button>
        ))}
      </div>
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          apply("add");
        }}
      >
        <input className="field lnum !min-h-9 !w-20 !rounded-full !px-3 !py-1 text-sm" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} aria-label={`Amount for ${p.name_en}`} />
        <button type="button" className="chip !min-h-9 !px-2 !text-xs" onClick={() => setUnit((u) => (u === "kg" ? "g" : "kg"))}>
          {unit}
        </button>
        <button className="chip !min-h-9 !px-3 !text-xs" disabled={busy || !amount}>
          Add
        </button>
        <button type="button" className="chip !min-h-9 !px-3 !text-xs" disabled={busy || !amount} onClick={() => apply("remove")}>
          Remove
        </button>
        <button type="button" className="chip !min-h-9 !px-3 !text-xs" disabled={busy || amount === ""} onClick={() => apply("set")} title="Set the count to exactly this amount">
          Set
        </button>
      </form>
    </li>
  );
}

function ComboRow({ combo: c, buildable, products }: { combo: Combo; buildable: number; products: Product[] }) {
  const sb = supabaseBrowser()!;
  const toast = useToast();
  const [n, setN] = useState("1");
  const [busy, setBusy] = useState(false);
  const boxes = Math.round(Number(n));

  const pack = async (count: number) => {
    setBusy(true);
    const { error } = await sb.rpc("build_combo_boxes", { p_combo: c.id, p_boxes: count, p_note: null });
    setBusy(false);
    if (error) return toast(rpcMessage(error.message), "err");
    toast(count > 0 ? `Packed ${count} × ${c.name_en}` : `Unpacked ${-count} × ${c.name_en}`);
  };
  const setBoxed = async () => {
    setBusy(true);
    const { error } = await sb.rpc("adjust_stock", { p_product: null, p_combo: c.id, p_mode: "set", p_value: boxes, p_note: "box count" });
    setBusy(false);
    if (error) return toast(rpcMessage(error.message), "err");
    toast(`${c.name_en}: ${boxes} boxes on the shelf`);
  };

  return (
    <li className="rounded-[22px] bg-maroon p-5 text-paper">
      <div className="flex items-baseline justify-between">
        <p className="display text-3xl">{c.name_en}</p>
        <p className="lnum text-sm opacity-80">{c.items.length} items</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-paper/10 py-2">
          <motion.p key={c.boxed_stock} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="lnum display text-3xl">
            {c.boxed_stock}
          </motion.p>
          <p className="text-[11px] uppercase tracking-wider opacity-70">packed</p>
        </div>
        <div className="rounded-xl bg-paper/10 py-2">
          <p className="lnum display text-3xl">{buildable}</p>
          <p className="text-[11px] uppercase tracking-wider opacity-70">can build</p>
        </div>
      </div>
      <p className="mt-3 text-xs opacity-75">{c.items.map((i) => products.find((p) => p.id === i.product_id)?.name_en).join(" · ")}</p>
      <div className="mt-4 flex items-center gap-1">
        <input className="field lnum !min-h-9 !w-16 !rounded-full !px-3 !py-1 text-center text-sm text-ink" inputMode="numeric" value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, ""))} aria-label="Boxes" />
        <button className="chip !min-h-9 !bg-paper !px-3 !text-xs !text-ink" disabled={busy || !boxes || boxes > buildable} onClick={() => pack(boxes)} title="Uses loose stock">
          Pack
        </button>
        <button className="chip !min-h-9 !px-3 !text-xs !text-paper !shadow-[inset_0_0_0_1px_rgba(255,255,255,.4)]" disabled={busy || !boxes || boxes > c.boxed_stock} onClick={() => pack(-boxes)}>
          Unpack
        </button>
        <button className="chip !min-h-9 !px-3 !text-xs !text-paper !shadow-[inset_0_0_0_1px_rgba(255,255,255,.4)]" disabled={busy || n === ""} onClick={setBoxed} title="Count boxes already on the shelf (no loose stock change)">
          Set count
        </button>
      </div>
    </li>
  );
}
