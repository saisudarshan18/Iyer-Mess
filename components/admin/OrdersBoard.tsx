"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatINR, formatWeight } from "@/lib/pricing";
import type { Order, OrderItem, OrderStatus } from "@/lib/types";
import { chime } from "@/lib/chime";
import { directionsUrl, telUrl, whatsappUrl } from "@/lib/links";
import { rpcMessage, useToast } from "./AdminShell";
import { CourierQuotes } from "./CourierQuotes";

type Col = { key: string; title: string; statuses: OrderStatus[]; drop?: OrderStatus };
const COLUMNS: Col[] = [
  { key: "pay", title: "Awaiting payment", statuses: ["pending_payment"] },
  { key: "new", title: "New", statuses: ["confirmed"], drop: "confirmed" },
  { key: "prep", title: "Preparing", statuses: ["preparing"], drop: "preparing" },
  { key: "out", title: "Ready · Out · Shipped", statuses: ["ready", "out_for_delivery", "shipped"] },
  { key: "done", title: "Completed today", statuses: ["completed"], drop: "completed" },
];

/** What "advance" means for each fulfilment. */
function nextStatus(o: Order): OrderStatus | null {
  const path: Record<Order["fulfilment"], OrderStatus[]> = {
    delivery_local: ["confirmed", "preparing", "out_for_delivery", "completed"],
    courier: ["confirmed", "preparing", "shipped", "completed"],
    takeaway: ["confirmed", "preparing", "ready", "completed"],
    counter: ["completed"],
  };
  const p = path[o.fulfilment];
  const i = p.indexOf(o.status);
  return i >= 0 && i < p.length - 1 ? p[i + 1] : null;
}

const LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirm",
  preparing: "Start preparing",
  ready: "Mark ready",
  out_for_delivery: "Out for delivery",
  shipped: "Mark shipped",
  completed: "Complete",
  cancelled: "Cancel",
};

const FULFIL: Record<Order["fulfilment"], [string, string]> = {
  delivery_local: ["Local delivery", "bg-leaf text-paper"],
  courier: ["Courier", "bg-maroon text-paper"],
  takeaway: ["Takeaway", "bg-turmeric text-ink"],
  counter: ["Walk-in", "bg-paper-3 text-ink"],
};

const num = (o: Record<string, unknown>) =>
  ({ ...o, total: Number(o.total), subtotal: Number(o.subtotal), packing: Number(o.packing), delivery_fee: Number(o.delivery_fee), distance_km: o.distance_km === null ? null : Number(o.distance_km) }) as Order;

export function OrdersBoard() {
  const sb = supabaseBrowser()!;
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState(true);
  const [ship, setShip] = useState<Order | null>(null);
  // phones and tablets show one column at a time; "New" is where the work starts
  const [tab, setTab] = useState("new");
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const loadItems = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      const { data } = await sb.from("order_items").select("*").in("order_id", ids);
      const grouped: Record<string, OrderItem[]> = {};
      for (const i of data ?? []) (grouped[i.order_id] ??= []).push({ ...i, line_total: Number(i.line_total) });
      setItems((m) => ({ ...m, ...grouped }));
    },
    [sb],
  );

  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    (async () => {
      const [active, today] = await Promise.all([
        sb.from("orders").select("*").not("status", "in", "(completed,cancelled)").order("created_at"),
        sb.from("orders").select("*").eq("status", "completed").gte("updated_at", start.toISOString()).order("updated_at", { ascending: false }).limit(40),
      ]);
      const all = [...(active.data ?? []), ...(today.data ?? [])].map(num);
      setOrders(all);
      setLoading(false);
      loadItems(all.map((o) => o.id));
    })();

    const ch = sb
      .channel("admin-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, ({ new: row }) => {
        const o = num(row);
        setOrders((list) => [...list.filter((x) => x.id !== o.id), o]);
        // the order row lands before its items; give them a moment
        setTimeout(() => loadItems([o.id]), 600);
        if (o.channel === "online") {
          if (soundRef.current) chime();
          toast(`New order ${o.short_code} · ${formatINR(o.total)}`, "new");
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, ({ new: row }) => {
        const o = num(row);
        setOrders((list) => list.map((x) => (x.id === o.id ? o : x)));
        if (o.status === "confirmed" && o.payment_mode === "upi_online" && o.payment_status === "paid" && soundRef.current) chime();
      })
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [sb, loadItems, toast]);

  const setStatus = async (o: Order, status: OrderStatus, extra: { tracking?: string; courier?: string; markPaid?: boolean; note?: string } = {}) => {
    const { error } = await sb.rpc("set_order_status", {
      p_order: o.id,
      p_status: status,
      p_note: extra.note ?? null,
      p_tracking: extra.tracking ?? null,
      p_courier: extra.courier ?? null,
      p_mark_paid: extra.markPaid ?? false,
    });
    if (error) return toast(rpcMessage(error.message), "err");
    toast(`${o.short_code} → ${status.replace(/_/g, " ")}`);
    fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: o.id }) }).catch(() => {});
  };

  const advance = (o: Order) => {
    const next = nextStatus(o);
    if (!next) return;
    if (next === "shipped") return setShip(o);
    const unpaid = o.payment_status !== "paid" && next === "completed";
    setStatus(o, next, { markPaid: unpaid && confirm(`Mark ${o.short_code} as paid (${o.payment_mode.replace(/_/g, " ")})?`) });
  };

  const cancel = (o: Order) => {
    const note = prompt(`Cancel ${o.short_code}? Stock will be put back.\nReason (optional):`);
    if (note === null) return;
    setStatus(o, "cancelled", { note: note || "Cancelled by shop" });
    setOrders((l) => l.filter((x) => x.id !== o.id));
  };

  const byCol = useMemo(() => COLUMNS.map((c) => ({ col: c, list: orders.filter((o) => c.statuses.includes(o.status)) })), [orders]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-5xl">Orders</h1>
          <p className="text-sm text-ink-soft">Live. New online orders chime. Drag a card or use its button.</p>
        </div>
        <div className="flex gap-2">
          <button className="chip" aria-pressed={sound} onClick={() => setSound((s) => !s)}>
            Sound {sound ? "on" : "off"}
          </button>
          <Link href="/admin/pos" className="btn">
            + Walk-in order
          </Link>
        </div>
      </div>

      <CourierQuotes sound={sound} />

      <div className="sticky top-[60px] z-20 -mx-4 mb-4 flex gap-2 overflow-x-auto bg-paper/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8 xl:hidden" role="tablist" aria-label="Order status">
        {byCol.map(({ col, list }) => (
          <button
            key={col.key}
            role="tab"
            aria-selected={tab === col.key}
            onClick={() => setTab(col.key)}
            className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm transition-colors ${tab === col.key ? "bg-ink text-paper" : "bg-paper-2"}`}
          >
            {col.title}
            <span className={`lnum grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs ${tab === col.key ? "bg-paper text-ink" : list.length && col.key === "new" ? "bg-kumkum text-paper" : "bg-paper"}`}>{list.length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-64" />)}</div>
      ) : (
        <div className="grid gap-4 pb-4 xl:grid-cols-5">
          {byCol.map(({ col, list }) => (
            <section
              key={col.key}
              className={`min-w-0 rounded-[22px] bg-paper-2/70 p-3 ${tab === col.key ? "" : "hidden xl:block"}`}
              onDragOver={(e) => col.drop && e.preventDefault()}
              onDrop={(e) => {
                const o = orders.find((x) => x.id === e.dataTransfer.getData("text/order"));
                if (!o || !col.drop || o.status === col.drop) return;
                if (col.drop === "completed") return advanceTo(o, "completed");
                setStatus(o, col.drop);
              }}
            >
              <h2 className="hidden items-center justify-between px-2 pb-3 pt-1 text-sm xl:flex">
                <span className="smallcaps">{col.title}</span>
                <span className="lnum rounded-full bg-paper px-2 text-xs">{list.length}</span>
              </h2>
              {!list.length && <p className="px-2 py-10 text-center text-sm text-ink-mute xl:py-6">Nothing here right now.</p>}
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                <AnimatePresence initial={false}>
                  {list.map((o) => (
                    <motion.li
                      key={o.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    >
                      <div
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/order", o.id)}
                        className={`cursor-grab rounded-2xl bg-paper p-4 shadow-[inset_0_0_0_1px_var(--rule)] active:cursor-grabbing ${o.needs_attention ? "ring-2 ring-kumkum" : ""}`}
                      >
                        <OrderCard order={o} items={items[o.id]} />
                        <div className="mt-3 flex flex-wrap gap-2">
                          {nextStatus(o) && o.status !== "pending_payment" && (
                            <button className="btn !min-h-11 !px-4 !py-1.5 !text-sm xl:!min-h-9 xl:!text-xs" onClick={() => advance(o)}>
                              {LABEL[nextStatus(o)!]}
                            </button>
                          )}
                          <Link href={`/admin/receipt/${o.id}`} target="_blank" className="chip !min-h-11 xl:!min-h-9 xl:!text-xs">
                            Print
                          </Link>
                          {o.status !== "completed" && (
                            <button className="chip !min-h-11 text-kumkum xl:!min-h-9 xl:!text-xs" onClick={() => cancel(o)}>
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      )}

      <AnimatePresence>{ship && <ShipDialog order={ship} onClose={() => setShip(null)} onShip={(courier, tracking) => (setStatus(ship, "shipped", { courier, tracking }), setShip(null))} />}</AnimatePresence>
    </div>
  );

  function advanceTo(o: Order, status: OrderStatus) {
    const unpaid = o.payment_status !== "paid";
    setStatus(o, status, { markPaid: unpaid && confirm(`Mark ${o.short_code} as paid?`) });
  }
}

function OrderCard({ order: o, items }: { order: Order; items?: OrderItem[] }) {
  const [label, cls] = FULFIL[o.fulfilment];
  const age = Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="lnum font-semibold">{o.short_code}</p>
          <p className="text-sm">{o.customer_name ?? "Walk-in"}</p>
          {o.customer_phone && (
            <a href={`tel:+${o.customer_phone}`} className="lnum text-xs text-ink-soft underline-offset-2 hover:underline">
              {o.customer_phone}
            </a>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${cls}`}>{label}</span>
      </div>
      {o.slot_label && (
        <p className="lnum mt-2 rounded-lg bg-turmeric/20 px-2 py-1 text-xs">
          {o.slot_date} · {o.slot_label}
        </p>
      )}
      {o.address?.line && (
        <p className="mt-2 line-clamp-2 text-xs text-ink-soft">
          {o.address.line}
          {o.address.landmark ? ` · ${o.address.landmark}` : ""}
          {o.distance_km ? ` · ${o.distance_km} km` : ""}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {typeof o.address?.lat === "number" && typeof o.address?.lng === "number" && (
          <a href={directionsUrl(o.address.lat, o.address.lng, o.fulfilment === "delivery_local" ? "two-wheeler" : "driving")} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-leaf px-2.5 py-1 text-[11px] font-medium text-paper hover:bg-leaf/85" draggable={false}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="m3 11 19-9-9 19-2-8-8-2Z" />
            </svg>
            Directions
          </a>
        )}
        {o.customer_phone && (
          <>
            <a href={telUrl(o.customer_phone.slice(-10))} className="rounded-full px-2.5 py-1 text-[11px] shadow-[inset_0_0_0_1px_var(--rule)] hover:bg-paper-2" draggable={false}>
              Call
            </a>
            <a href={whatsappUrl(o.customer_phone, `Hello from Iyer Mess about your order ${o.short_code}. `)!} target="_blank" rel="noopener noreferrer" className="rounded-full px-2.5 py-1 text-[11px] text-[#128C7E] shadow-[inset_0_0_0_1px_var(--rule)] hover:bg-[#25D366]/10" draggable={false}>
              WhatsApp
            </a>
          </>
        )}
      </div>
      <ul className="mt-2 space-y-0.5 text-xs">
        {items ? (
          items.map((i) => (
            <li key={i.id} className="flex justify-between gap-2">
              <span>
                {i.name_en}
                {i.grams ? ` ${formatWeight(i.grams)}` : ""} × {i.qty}
              </span>
            </li>
          ))
        ) : (
          <li className="skeleton h-3 w-2/3" />
        )}
      </ul>
      {o.notes && <p className="mt-2 rounded-lg bg-paper-2 px-2 py-1 text-xs italic">“{o.notes}”</p>}
      <div className="mt-3 flex items-center justify-between border-t border-rule pt-2 text-xs">
        <span className={o.payment_status === "paid" ? "text-leaf" : "text-kumkum"}>
          {o.payment_mode.replace(/_/g, " ")} · {o.payment_status}
        </span>
        <span className="price text-sm font-semibold">{formatINR(o.total)}</span>
      </div>
      {o.needs_attention && <p className="mt-2 text-xs font-medium text-kumkum">Paid after the hold expired. Refund or re-confirm.</p>}
      <p className="mt-1 text-[11px] text-ink-mute">{age < 60 ? `${age} min ago` : new Date(o.created_at).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })}</p>
    </>
  );
}

function ShipDialog({ order, onClose, onShip }: { order: Order; onClose: () => void; onShip: (courier: string, tracking: string) => void }) {
  const [courier, setCourier] = useState(order.courier_name ?? "");
  const [tracking, setTracking] = useState(order.tracking_no ?? "");
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl bg-paper p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onShip(courier.trim(), tracking.trim());
        }}
      >
        <p className="display text-3xl">Ship {order.short_code}</p>
        <label className="label mt-4">Courier</label>
        <input className="field" value={courier} onChange={(e) => setCourier(e.target.value)} required />
        <label className="label mt-3">Tracking number</label>
        <input className="field lnum" value={tracking} onChange={(e) => setTracking(e.target.value)} required />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Back
          </button>
          <button className="btn">Mark shipped</button>
        </div>
      </motion.form>
    </motion.div>
  );
}
