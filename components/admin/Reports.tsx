"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatINR, formatWeight } from "@/lib/pricing";
import type { Order, OrderItem } from "@/lib/types";
import { kg } from "./useCatalog";

type Movement = { id: number; product_id: string | null; combo_id: string | null; delta: number; balance_after: number; reason: string; note: string | null; order_id: string | null; created_at: string };
type Low = { kind: string; id: string; name_en: string; stock: number; threshold: number };

const istDate = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
/** IST day boundaries as UTC instants. */
const dayStart = (date: string) => new Date(`${date}T00:00:00+05:30`).toISOString();
const dayEnd = (date: string) => new Date(new Date(`${date}T00:00:00+05:30`).getTime() + 86400_000).toISOString();

export function Reports() {
  const sb = supabaseBrowser()!;
  const today = istDate(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [moves, setMoves] = useState<Movement[]>([]);
  const [low, setLow] = useState<Low[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [o, m, l, p, c] = await Promise.all([
        sb.from("orders").select("*").gte("created_at", dayStart(from)).lt("created_at", dayEnd(to)).order("created_at", { ascending: false }).limit(5000),
        sb.from("stock_movements").select("*").gte("created_at", dayStart(from)).lt("created_at", dayEnd(to)).order("created_at", { ascending: false }).limit(5000),
        sb.from("low_stock").select("*"),
        sb.from("products").select("id, name_en"),
        sb.from("combos").select("id, name_en"),
      ]);
      const list = (o.data ?? []).map((x) => ({ ...x, total: Number(x.total), subtotal: Number(x.subtotal), packing: Number(x.packing), delivery_fee: Number(x.delivery_fee) })) as Order[];
      setOrders(list);
      setMoves(m.data ?? []);
      setLow(l.data ?? []);
      setNames(Object.fromEntries([...(p.data ?? []), ...(c.data ?? [])].map((r) => [r.id, r.name_en])));
      const ids = list.filter((x) => x.status !== "cancelled").map((x) => x.id);
      const chunks: OrderItem[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await sb.from("order_items").select("*").in("order_id", ids.slice(i, i + 200));
        chunks.push(...((data ?? []).map((x) => ({ ...x, line_total: Number(x.line_total) })) as OrderItem[]));
      }
      setItems(chunks);
      setLoading(false);
    })();
  }, [sb, from, to]);

  const valid = orders.filter((o) => o.status !== "cancelled" && !(o.status === "pending_payment" && o.payment_status !== "paid"));

  // cash vs UPI × online vs walk-in
  const grid = useMemo(() => {
    const cell = (channel: string, cash: boolean) =>
      valid
        .filter((o) => o.channel === channel && (o.payment_mode === "cash") === cash)
        .reduce((acc, o) => ({ n: acc.n + 1, sum: acc.sum + o.total, paid: acc.paid + (o.payment_status === "paid" ? o.total : 0) }), { n: 0, sum: 0, paid: 0 });
    return {
      walkin: { cash: cell("walkin", true), upi: cell("walkin", false) },
      online: { cash: cell("online", true), upi: cell("online", false) },
    };
  }, [valid]);
  const grand = valid.reduce((s, o) => s + o.total, 0);
  const deliveryFees = valid.reduce((s, o) => s + o.delivery_fee, 0);

  const sold = useMemo(() => {
    const map = new Map<string, { name: string; grams: number; qty: number; amount: number }>();
    for (const i of items) {
      const key = i.product_id ?? i.combo_id ?? i.name_en;
      const r = map.get(key) ?? { name: i.name_en, grams: 0, qty: 0, amount: 0 };
      r.grams += (i.grams ?? 0) * i.qty;
      r.qty += i.qty;
      r.amount += i.line_total;
      map.set(key, r);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [items]);

  const shownMoves = moves.filter((m) => reason === "all" || m.reason === reason);

  const exportBook = (type: "xlsx" | "csv") => {
    const ordersSheet = XLSX.utils.json_to_sheet(
      orders.map((o) => ({
        code: o.short_code,
        created: new Date(o.created_at).toLocaleString("en-IN"),
        channel: o.channel,
        fulfilment: o.fulfilment,
        status: o.status,
        customer: o.customer_name ?? "",
        phone: o.customer_phone ?? "",
        payment_mode: o.payment_mode,
        payment_status: o.payment_status,
        subtotal: o.subtotal,
        packing: o.packing,
        delivery_fee: o.delivery_fee,
        total: o.total,
        slot: o.slot_label ? `${o.slot_date} ${o.slot_label}` : "",
      })),
    );
    if (type === "csv") {
      const blob = new Blob([XLSX.utils.sheet_to_csv(ordersSheet)], { type: "text/csv" });
      return download(blob, `iyer-mess-orders-${from}_${to}.csv`);
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ordersSheet, "Orders");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sold.map((s) => ({ item: s.name, qty: s.qty, kg: s.grams ? s.grams / 1000 : "", amount: s.amount }))), "Items sold");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(moves.map((m) => ({ time: new Date(m.created_at).toLocaleString("en-IN"), item: names[m.product_id ?? m.combo_id ?? ""] ?? "", unit: m.combo_id ? "boxes" : "grams", delta: m.delta, balance: m.balance_after, reason: m.reason, note: m.note ?? "" }))),
      "Stock movements",
    );
    XLSX.writeFile(wb, `iyer-mess-${from}_${to}.xlsx`);
  };

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-5xl">Reports</h1>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="label">From</span>
            <input type="date" className="field !min-h-10" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="label">To</span>
            <input type="date" className="field !min-h-10" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button className="chip" onClick={() => (setFrom(today), setTo(today))}>Today</button>
          <button className="chip" onClick={() => exportBook("csv")}>CSV</button>
          <button className="btn !min-h-10" onClick={() => exportBook("xlsx")}>Export Excel</button>
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-72" />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <Stat label="Sales" value={formatINR(grand)} sub={`${valid.length} orders`} big />
            <Stat label="Walk-in" value={formatINR(grid.walkin.cash.sum + grid.walkin.upi.sum)} sub={`Cash ${formatINR(grid.walkin.cash.sum)} · UPI ${formatINR(grid.walkin.upi.sum)}`} />
            <Stat label="Online" value={formatINR(grid.online.cash.sum + grid.online.upi.sum)} sub={`Cash ${formatINR(grid.online.cash.sum)} · UPI ${formatINR(grid.online.upi.sum)}`} />
            <Stat label="Delivery fees" value={formatINR(deliveryFees)} sub={`${orders.filter((o) => o.status === "cancelled").length} cancelled`} />
          </section>

          <section className="mt-8 overflow-x-auto rounded-[22px] bg-paper-2/60 p-5">
            <h2 className="smallcaps mb-3 text-ink-mute">Payment split</h2>
            <table className="lnum w-full min-w-[480px] text-sm">
              <thead className="text-left text-ink-soft">
                <tr>
                  <th className="py-2 font-normal" />
                  <th className="font-normal">Cash</th>
                  <th className="font-normal">UPI</th>
                  <th className="font-normal">Total</th>
                  <th className="font-normal">Still to collect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {(["walkin", "online"] as const).map((ch) => {
                  const r = grid[ch];
                  const sum = r.cash.sum + r.upi.sum;
                  const paid = r.cash.paid + r.upi.paid;
                  return (
                    <tr key={ch}>
                      <td className="py-2 font-medium">{ch === "walkin" ? "Walk-in" : "Online"}</td>
                      <td>{formatINR(r.cash.sum)} <span className="text-ink-mute">({r.cash.n})</span></td>
                      <td>{formatINR(r.upi.sum)} <span className="text-ink-mute">({r.upi.n})</span></td>
                      <td className="font-semibold">{formatINR(sum)}</td>
                      <td className={sum - paid > 0 ? "text-kumkum" : "text-ink-mute"}>{formatINR(sum - paid)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <div className="mt-8 grid gap-8 xl:grid-cols-2">
            <section>
              <h2 className="smallcaps mb-3 text-ink-mute">Items sold</h2>
              <ul className="divide-y divide-rule rounded-[22px] bg-paper-2/60 px-5">
                {sold.length === 0 && <li className="py-6 text-sm text-ink-mute">No sales in this range.</li>}
                {sold.map((s) => (
                  <li key={s.name} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="flex-1">{s.name}</span>
                    <span className="lnum text-ink-soft">{s.grams ? formatWeight(s.grams) : `${s.qty} box`}</span>
                    <span className="price w-24 text-right">{formatINR(s.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="smallcaps mb-3 text-ink-mute">Low stock</h2>
              <ul className="divide-y divide-rule rounded-[22px] bg-kumkum/[0.06] px-5">
                {low.length === 0 && <li className="py-6 text-sm text-ink-mute">Everything is above its low-stock level.</li>}
                {low.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="flex-1">{l.name_en}</span>
                    <span className="lnum text-kumkum">{l.kind === "combo" ? `${l.stock} boxes` : `${kg(l.stock)} kg`}</span>
                    <span className="lnum text-xs text-ink-mute">below {l.kind === "combo" ? l.threshold : `${kg(l.threshold)} kg`}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="smallcaps text-ink-mute">Stock movements</h2>
              <div className="flex flex-wrap gap-1">
                {["all", "restock", "manual_adjust", "sale_online", "sale_walkin", "cancel_restore", "combo_build", "combo_unbox"].map((r) => (
                  <button key={r} className="chip !min-h-8 !text-xs" aria-pressed={reason === r} onClick={() => setReason(r)}>
                    {r.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto rounded-[22px] bg-paper-2/60 p-2">
              <table className="lnum w-full min-w-[640px] text-sm">
                <thead className="text-left text-ink-soft">
                  <tr>
                    <th className="px-3 py-2 font-normal">Time</th>
                    <th className="font-normal">Item</th>
                    <th className="text-right font-normal">Change</th>
                    <th className="text-right font-normal">After</th>
                    <th className="px-3 font-normal">Reason</th>
                    <th className="font-normal">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {shownMoves.slice(0, 500).map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2 text-ink-soft">{new Date(m.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td>{names[m.product_id ?? m.combo_id ?? ""] ?? "—"}</td>
                      <td className={`text-right ${m.delta < 0 ? "text-kumkum" : "text-leaf"}`}>
                        {m.delta > 0 ? "+" : ""}
                        {m.combo_id ? `${m.delta} box` : `${kg(m.delta)} kg`}
                      </td>
                      <td className="text-right">{m.combo_id ? m.balance_after : `${kg(m.balance_after)} kg`}</td>
                      <td className="px-3">{m.reason.replace(/_/g, " ")}</td>
                      <td className="text-ink-soft">{m.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, big }: { label: string; value: string; sub: string; big?: boolean }) {
  return (
    <div className={`rounded-[22px] p-5 ${big ? "bg-ink text-paper" : "bg-paper-2/60"}`}>
      <p className={`smallcaps ${big ? "text-paper/60" : "text-ink-mute"}`}>{label}</p>
      <p className="display price mt-2 text-4xl">{value}</p>
      <p className={`mt-1 text-xs ${big ? "text-paper/70" : "text-ink-soft"}`}>{sub}</p>
    </div>
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
