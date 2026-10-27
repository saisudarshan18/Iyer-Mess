"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { chime } from "@/lib/chime";
import { directionsUrl, telUrl, whatsappUrl } from "@/lib/links";
import { formatINR, formatWeight } from "@/lib/pricing";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { CourierRequest } from "@/lib/types";
import { useToast } from "./AdminShell";

const num = (r: Record<string, unknown>) =>
  ({ ...r, subtotal: Number(r.subtotal), packing: Number(r.packing), courier_fee: r.courier_fee === null ? null : Number(r.courier_fee), distance_km: r.distance_km === null ? null : Number(r.distance_km) }) as CourierRequest;

/**
 * Courier deliveries beyond the local radius: weigh the parcel, check the courier
 * company's rate for the address, and send the charge. The order is only placed
 * once the customer approves and pays.
 */
export function CourierQuotes({ sound }: { sound: boolean }) {
  const sb = supabaseBrowser()!;
  const toast = useToast();
  const [list, setList] = useState<CourierRequest[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const soundRef = useRef(sound);
  soundRef.current = sound;

  useEffect(() => {
    (async () => {
      const [q, p, c] = await Promise.all([
        sb.from("courier_requests").select("*").in("status", ["requested", "quoted"]).order("created_at"),
        sb.from("products").select("id, name_en"),
        sb.from("combos").select("id, name_en"),
      ]);
      setList((q.data ?? []).map(num));
      setNames(Object.fromEntries([...(p.data ?? []), ...(c.data ?? [])].map((x) => [x.id, x.name_en])));
    })();
    const ch = sb
      .channel("admin-courier-quotes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "courier_requests" }, ({ new: row }) => {
        const r = num(row);
        setList((l) => [...l.filter((x) => x.id !== r.id), r]);
        if (soundRef.current) chime();
        toast(`Courier quote needed · ${r.short_code}`, "new");
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "courier_requests" }, ({ new: row }) => {
        const r = num(row);
        setList((l) => (r.status === "requested" || r.status === "quoted" ? l.map((x) => (x.id === r.id ? r : x)) : l.filter((x) => x.id !== r.id)));
      })
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [sb, toast]);

  if (!list.length) return null;

  return (
    <section className="mb-6 rounded-[22px] bg-maroon/10 p-3">
      <h2 className="flex items-center justify-between px-2 pb-3 pt-1 text-sm">
        <span className="smallcaps">Courier quotes · beyond local delivery</span>
        <span className="lnum rounded-full bg-maroon px-2 text-xs text-paper">{list.length}</span>
      </h2>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence initial={false}>
          {list.map((r) => (
            <motion.li key={r.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <QuoteCard r={r} names={names} onDone={(next) => setList((l) => (next.status === "quoted" ? l.map((x) => (x.id === next.id ? next : x)) : l.filter((x) => x.id !== next.id)))} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

function QuoteCard({ r, names, onDone }: { r: CourierRequest; names: Record<string, string>; onDone: (r: CourierRequest) => void }) {
  const toast = useToast();
  const [fee, setFee] = useState(r.courier_fee?.toString() ?? "");
  const [courier, setCourier] = useState(r.courier_name ?? "");
  const [note, setNote] = useState(r.shop_note ?? "");
  const [busy, setBusy] = useState(false);
  const a = r.address;

  const send = async (action: "quote" | "reject") => {
    if (action === "reject" && !confirm(`Tell the customer ${r.short_code} can't be sent by courier?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/courier-requests/${r.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "quote" ? { action, fee: Number(fee), courier_name: courier || undefined, note: note || undefined } : { action, note: note || undefined }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return toast(json.error === "QUOTE_CLOSED" ? "The customer has already answered this quote." : "Couldn't send. Try again.", "err");
    toast(action === "quote" ? `${r.short_code}: charge sent to the customer` : `${r.short_code}: customer told`);
    onDone(json.request);
  };

  return (
    <div className="rounded-2xl bg-paper p-4 shadow-[inset_0_0_0_1px_var(--rule)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="lnum font-semibold">{r.short_code}</p>
          <p className="text-sm">{r.customer_name}</p>
          <a href={`tel:+${r.customer_phone}`} className="lnum text-xs text-ink-soft hover:underline">
            {r.customer_phone}
          </a>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${r.status === "quoted" ? "bg-turmeric text-ink" : "bg-maroon text-paper"}`}>{r.status === "quoted" ? "Waiting for customer" : "Needs a quote"}</span>
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        {a.line}
        {a.landmark ? ` · ${a.landmark}` : ""}
        {[a.district, a.pincode].filter(Boolean).length ? ` · ${[a.district, a.pincode].filter(Boolean).join(" ")}` : ""}
      </p>
      <p className="lnum mt-1 text-xs">
        <b>{formatWeight(r.weight_g)}</b> net · {r.distance_km ?? "?"} km
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <a href={directionsUrl(a.lat, a.lng, "driving")} target="_blank" rel="noopener noreferrer" className="rounded-full bg-leaf px-2.5 py-1 text-[11px] font-medium text-paper">
          Map
        </a>
        <a href={telUrl(r.customer_phone.slice(-10))} className="rounded-full px-2.5 py-1 text-[11px] shadow-[inset_0_0_0_1px_var(--rule)]">
          Call
        </a>
        <a href={whatsappUrl(r.customer_phone, `Hello from Iyer Mess about your courier request ${r.short_code}. `)!} target="_blank" rel="noopener noreferrer" className="rounded-full px-2.5 py-1 text-[11px] text-[#128C7E] shadow-[inset_0_0_0_1px_var(--rule)]">
          WhatsApp
        </a>
      </div>
      <ul className="mt-2 space-y-0.5 text-xs">
        {r.items.map((it, i) => (
          <li key={i}>
            {names[it.id] ?? "Item"}
            {it.type === "product" ? ` ${formatWeight(it.grams)}` : ""} × {it.qty}
          </li>
        ))}
      </ul>
      {r.notes && <p className="mt-2 rounded-lg bg-paper-2 px-2 py-1 text-xs italic">“{r.notes}”</p>}
      <p className="mt-2 text-xs text-ink-soft">Items {formatINR(r.subtotal + r.packing)}</p>

      <form
        className="mt-3 grid gap-2 border-t border-rule pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          send("quote");
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            Courier charge ₹
            <input className="field lnum !min-h-10 !py-1.5" type="number" inputMode="decimal" min={0} step="1" required value={fee} onChange={(e) => setFee(e.target.value)} />
          </label>
          <label className="text-xs">
            Courier (optional)
            <input className="field !min-h-10 !py-1.5" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="ST Courier" maxLength={80} />
          </label>
        </div>
        <label className="text-xs">
          Note to customer (optional)
          <input className="field !min-h-10 !py-1.5" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Parcel 1.4 kg, 2–3 days" maxLength={300} />
        </label>
        {fee !== "" && <p className="text-xs">Customer pays <b className="price">{formatINR(r.subtotal + r.packing + Number(fee))}</b></p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn !min-h-10 !px-4 !py-1.5 !text-sm" disabled={busy || fee === ""}>
            {r.status === "quoted" ? "Update charge" : "Send charge"}
          </button>
          <button type="button" className="chip !min-h-10 text-kumkum" disabled={busy} onClick={() => send("reject")}>
            Can&apos;t ship
          </button>
        </div>
      </form>
    </div>
  );
}
