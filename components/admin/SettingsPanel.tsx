"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { AddressPicker } from "@/components/checkout/AddressPicker";
import { ProductArt } from "@/components/art/SweetGlyph";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatINR } from "@/lib/pricing";
import type { Combo, DeliverySlab, Product, Settings, TimeSlot } from "@/lib/types";
import { useToast } from "./AdminShell";
import { useCatalog } from "./useCatalog";
import { ContentTab } from "./ContentTab";

const TABS = ["Shop", "Delivery", "Time slots", "Products", "Combos", "Content", "Staff"] as const;
type Tab = (typeof TABS)[number];

export function SettingsPanel() {
  const [tab, setTab] = useState<Tab>("Shop");
  return (
    <div>
      <h1 className="display mb-6 text-5xl">Settings</h1>
      <div className="mb-8 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`relative rounded-full px-4 py-2 text-sm ${tab === t ? "text-paper" : "hover:bg-paper-2"}`}>
            {tab === t && <motion.span layoutId="settings-tab" className="absolute inset-0 rounded-full bg-ink" />}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>
      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {tab === "Shop" && <ShopTab />}
        {tab === "Delivery" && <SlabsTab />}
        {tab === "Time slots" && <SlotsTab />}
        {tab === "Products" && <ProductsTab />}
        {tab === "Combos" && <CombosTab />}
        {tab === "Content" && <ContentTab />}
        {tab === "Staff" && <StaffTab />}
      </motion.div>
    </div>
  );
}

function useSave() {
  const toast = useToast();
  return (error: { message: string } | null, ok = "Saved") => (error ? toast(error.message, "err") : toast(ok));
}

/* ─────────── shop ─────────── */

function ShopTab() {
  const sb = supabaseBrowser()!;
  const save = useSave();
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    sb.from("settings").select("*").eq("id", 1).single().then(({ data }) => setS({ ...data, local_radius_km: Number(data.local_radius_km) }));
  }, [sb]);
  if (!s) return <div className="skeleton h-80" />;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  const submit = async () => {
    const { error } = await sb
      .from("settings")
      .update({
        shop_name: s.shop_name,
        shop_address: s.shop_address,
        shop_phone: s.shop_phone,
        shop_lat: s.shop_lat,
        shop_lng: s.shop_lng,
        local_radius_km: s.local_radius_km,
        allowed_state: s.allowed_state,
        hold_minutes: s.hold_minutes,
        booking_days_ahead: s.booking_days_ahead,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    save(error);
  };

  return (
    <div className="grid max-w-5xl gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        <Field label="Shop name" value={s.shop_name} onChange={(v) => set("shop_name", v)} />
        <div>
          <label className="label">Address (printed on receipts and the footer)</label>
          <textarea className="field min-h-24" value={s.shop_address ?? ""} onChange={(e) => set("shop_address", e.target.value)} />
        </div>
        <Field label="Phone" value={s.shop_phone ?? ""} onChange={(v) => set("shop_phone", v)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Local radius (km)" type="number" value={String(s.local_radius_km)} onChange={(v) => set("local_radius_km", Number(v))} />
          <Field label="Courier state" value={s.allowed_state} onChange={(v) => set("allowed_state", v)} />
          <Field label="UPI payment hold (min)" type="number" value={String(s.hold_minutes)} onChange={(v) => set("hold_minutes", Number(v))} />
          <Field label="Book up to (days ahead)" type="number" value={String(s.booking_days_ahead)} onChange={(v) => set("booking_days_ahead", Number(v))} />
        </div>
        <button className="btn" onClick={submit}>
          Save shop settings
        </button>
      </div>
      <div>
        <p className="label">Shop location: all delivery distances are measured from here</p>
        <AddressPicker
          value={s.shop_lat !== null && s.shop_lng !== null ? { line: s.shop_address ?? "", landmark: "", lat: s.shop_lat, lng: s.shop_lng } : null}
          center={null}
          onChange={(a) => setS({ ...s, shop_lat: a.lat, shop_lng: a.lng, shop_address: s.shop_address || a.line })}
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Latitude" type="number" value={s.shop_lat === null ? "" : String(s.shop_lat)} onChange={(v) => set("shop_lat", v === "" ? null : Number(v))} />
          <Field label="Longitude" type="number" value={s.shop_lng === null ? "" : String(s.shop_lng)} onChange={(v) => set("shop_lng", v === "" ? null : Number(v))} />
        </div>
      </div>
    </div>
  );
}

/* ─────────── delivery slabs ─────────── */

function SlabsTab() {
  const sb = supabaseBrowser()!;
  const save = useSave();
  const [rows, setRows] = useState<DeliverySlab[] | null>(null);
  const load = () =>
    sb.from("delivery_slabs").select("*").order("from_km").then(({ data }) => setRows((data ?? []).map((r) => ({ ...r, from_km: Number(r.from_km), to_km: r.to_km === null ? null : Number(r.to_km), fee: Number(r.fee) }))));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return <div className="skeleton h-60" />;

  const update = (i: number, patch: Partial<DeliverySlab>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const persist = async (r: DeliverySlab) => {
    const { id, ...rest } = r;
    const { error } = id ? await sb.from("delivery_slabs").update(rest).eq("id", id) : await sb.from("delivery_slabs").insert(rest);
    save(error);
    if (!error) load();
  };
  const remove = async (r: DeliverySlab) => {
    if (r.id && confirm("Delete this slab?")) {
      save((await sb.from("delivery_slabs").delete().eq("id", r.id)).error, "Deleted");
      load();
    } else if (!r.id) setRows(rows.filter((x) => x !== r));
  };

  return (
    <div className="max-w-5xl">
      <p className="mb-4 text-sm text-ink-soft">
        A distance belongs to the slab where <i>from ≤ distance &lt; to</i>. Leave “to” empty for “and beyond”. These slabs price local delivery only (within the local radius), where customers can pay cash/UPI on delivery. Beyond it, the customer sends a courier request: you weigh the parcel and enter the courier company&rsquo;s charge on the Orders screen, and the order is placed once they approve and pay by UPI.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-ink-soft">
            <tr>
              <th className="pb-2 font-normal">From km</th>
              <th className="font-normal">To km</th>
              <th className="font-normal">Fee ₹</th>
              <th className="font-normal">Delivery time (EN)</th>
              <th className="font-normal">Delivery time (TA)</th>
              <th className="font-normal">On</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id || `new${i}`} className="align-top">
                <td className="pr-2 pb-2"><input className="field lnum !min-h-10" type="number" value={r.from_km} onChange={(e) => update(i, { from_km: Number(e.target.value) })} /></td>
                <td className="pr-2"><input className="field lnum !min-h-10" type="number" value={r.to_km ?? ""} placeholder="∞" onChange={(e) => update(i, { to_km: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                <td className="pr-2"><input className="field lnum !min-h-10" type="number" value={r.fee} onChange={(e) => update(i, { fee: Number(e.target.value) })} /></td>
                <td className="pr-2"><input className="field !min-h-10" value={r.eta_label_en} onChange={(e) => update(i, { eta_label_en: e.target.value })} /></td>
                <td className="pr-2"><input className="field tamil !min-h-10" value={r.eta_label_ta ?? ""} onChange={(e) => update(i, { eta_label_ta: e.target.value })} /></td>
                <td className="pr-2 pt-3"><input type="checkbox" checked={r.active} onChange={(e) => update(i, { active: e.target.checked })} className="h-5 w-5 accent-[var(--ink)]" /></td>
                <td className="whitespace-nowrap">
                  <button className="chip !min-h-10" onClick={() => persist(r)}>Save</button>{" "}
                  <button className="chip !min-h-10 text-kumkum" onClick={() => remove(r)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="btn btn-ghost mt-4"
        onClick={() => {
          const last = rows.at(-1);
          setRows([...rows, { id: "", from_km: last?.to_km ?? 0, to_km: null, fee: 0, eta_label_en: "", eta_label_ta: "", active: true }]);
        }}
      >
        + Add slab
      </button>
    </div>
  );
}

/* ─────────── time slots ─────────── */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SlotsTab() {
  const sb = supabaseBrowser()!;
  const save = useSave();
  const [rows, setRows] = useState<TimeSlot[] | null>(null);
  const load = () => sb.from("time_slots").select("*").order("sort").order("start_time").then(({ data }) => setRows(data ?? []));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return <div className="skeleton h-60" />;
  const update = (i: number, patch: Partial<TimeSlot>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const persist = async (r: TimeSlot) => {
    const { id, ...rest } = r;
    const { error } = id ? await sb.from("time_slots").update(rest).eq("id", id) : await sb.from("time_slots").insert(rest);
    save(error);
    if (!error) load();
  };
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="max-w-5xl space-y-3">
      <p className="text-sm text-ink-soft">Customers choose a date and one of these slots for takeaway and local delivery. Capacity is the number of orders per slot per day.</p>
      {rows.map((r, i) => (
        <div key={r.id || `n${i}`} className="grid gap-3 rounded-[20px] bg-paper-2/60 p-4 md:grid-cols-[1.4fr_.8fr_.8fr_.7fr_auto]">
          <Field label="Label" value={r.label} onChange={(v) => update(i, { label: v })} />
          <Field label="Start" type="time" value={r.start_time.slice(0, 5)} onChange={(v) => update(i, { start_time: v })} />
          <Field label="End" type="time" value={r.end_time.slice(0, 5)} onChange={(v) => update(i, { end_time: v })} />
          <Field label="Capacity" type="number" value={String(r.capacity)} onChange={(v) => update(i, { capacity: Number(v) })} />
          <div className="flex items-end gap-2">
            <button className="chip !min-h-12" onClick={() => persist(r)}>Save</button>
            {r.id && (
              <button className="chip !min-h-12 text-kumkum" onClick={async () => confirm("Delete slot?") && (save((await sb.from("time_slots").delete().eq("id", r.id)).error, "Deleted"), load())}>
                ✕
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1 md:col-span-3">
            {DAYS.map((d, k) => (
              <button key={d} className="chip !min-h-8 !text-xs" aria-pressed={r.days_of_week.includes(k)} onClick={() => update(i, { days_of_week: toggle(r.days_of_week, k).sort() })}>
                {d}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 md:col-span-2">
            {(["takeaway", "delivery_local"] as const).map((a) => (
              <button key={a} className="chip !min-h-8 !text-xs" aria-pressed={r.applies_to.includes(a)} onClick={() => update(i, { applies_to: toggle(r.applies_to, a) })}>
                {a === "takeaway" ? "Takeaway" : "Local delivery"}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-1 text-xs">
              <input type="checkbox" checked={r.active} onChange={(e) => update(i, { active: e.target.checked })} /> active
            </label>
          </div>
        </div>
      ))}
      <button
        className="btn btn-ghost"
        onClick={() => setRows([...rows, { id: "", label: "", start_time: "10:00", end_time: "12:00", capacity: 20, days_of_week: [0, 1, 2, 3, 4, 5, 6], applies_to: ["takeaway", "delivery_local"], active: true }])}
      >
        + Add slot
      </button>
    </div>
  );
}

/* ─────────── products ─────────── */

function ProductsTab() {
  const { products, loading, reload } = useCatalog();
  const [editing, setEditing] = useState<Product | null>(null);
  if (loading) return <div className="skeleton h-96" />;
  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <ul className="divide-y divide-rule rounded-[22px] bg-paper-2/60 lg:col-span-5">
        {products.map((p) => (
          <li key={p.id}>
            <button onClick={() => setEditing(p)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper-3/50 ${editing?.id === p.id ? "bg-paper-3/60" : ""} ${p.active ? "" : "opacity-50"}`}>
              <ProductArt slug={p.slug} image={p.image} alt="" className="h-10 w-10" />
              <span className="flex-1">{p.name_en}</span>
              <span className="price text-sm">{formatINR(p.price_per_kg)}/kg</span>
            </button>
          </li>
        ))}
        <li>
          <button
            className="w-full px-4 py-3 text-left text-sm text-ink-soft hover:bg-paper-3/50"
            onClick={() =>
              setEditing({ id: "", slug: "", name_en: "", name_ta: "", category: "sweet", price_per_kg: 0, image: null, description_en: null, description_ta: null, sell_sizes: [250, 500, 1000], low_stock_g: 2000, active: true, sort: products.length + 1 })
            }
          >
            + New item
          </button>
        </li>
      </ul>
      <div className="lg:col-span-7">{editing ? <ProductForm key={editing.id || "new"} product={editing} onSaved={() => (reload(), setEditing(null))} /> : <p className="text-ink-soft">Pick an item to edit its price, names, photo or sizes.</p>}</div>
    </div>
  );
}

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function ProductForm({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const sb = supabaseBrowser()!;
  const save = useSave();
  const [p, setP] = useState(product);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP({ ...p, [k]: v });

  const upload = async (file: File) => {
    setUploading(true);
    const path = `${p.slug || slugify(p.name_en) || "item"}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await sb.storage.from("products").upload(path, file, { upsert: true, contentType: file.type });
    setUploading(false);
    if (error) return save(error);
    set("image", sb.storage.from("products").getPublicUrl(path).data.publicUrl);
  };

  const submit = async () => {
    const { id, ...rest } = p;
    const row = { ...rest, slug: rest.slug || slugify(rest.name_en) };
    const { error } = id ? await sb.from("products").update(row).eq("id", id) : await sb.from("products").insert(row);
    save(error);
    if (!error) onSaved();
  };

  return (
    <div className="space-y-4 rounded-[22px] bg-paper-2/40 p-5">
      <div className="flex items-center gap-4">
        <ProductArt slug={p.slug} image={p.image} alt="" className="h-24 w-24 rounded-2xl bg-paper" />
        <label className="btn btn-ghost cursor-pointer">
          {uploading ? "Uploading…" : "Upload photo"}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {p.image && (
          <button className="ink-link text-sm" onClick={() => set("image", null)}>
            Use illustration
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name (English)" value={p.name_en} onChange={(v) => set("name_en", v)} />
        <Field label="Name (Tamil)" value={p.name_ta} onChange={(v) => set("name_ta", v)} tamil />
        <Field label="Price per kg ₹" type="number" value={String(p.price_per_kg)} onChange={(v) => set("price_per_kg", Number(v))} />
        <div>
          <label className="label">Category</label>
          <div className="flex gap-2">
            {(["sweet", "savory"] as const).map((c) => (
              <button key={c} className="chip" aria-pressed={p.category === c} onClick={() => set("category", c)}>
                {c === "sweet" ? "Sweet" : "Savory"}
              </button>
            ))}
          </div>
        </div>
        <Field label="Pack sizes (grams, comma separated)" value={p.sell_sizes.join(", ")} onChange={(v) => set("sell_sizes", v.split(",").map((x) => Number(x.trim())).filter((x) => x > 0))} />
        <Field label="Low-stock alert below (grams)" type="number" value={String(p.low_stock_g)} onChange={(v) => set("low_stock_g", Number(v))} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Description (English)</label>
          <textarea className="field min-h-20" value={p.description_en ?? ""} onChange={(e) => set("description_en", e.target.value || null)} />
        </div>
        <div>
          <label className="label">Description (Tamil)</label>
          <textarea className="field tamil min-h-20" value={p.description_ta ?? ""} onChange={(e) => set("description_ta", e.target.value || null)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={p.active} onChange={(e) => set("active", e.target.checked)} className="h-5 w-5" /> Show on the website and in the POS
      </label>
      <button className="btn" onClick={submit}>
        Save item
      </button>
    </div>
  );
}

/* ─────────── combos ─────────── */

function CombosTab() {
  const sb = supabaseBrowser()!;
  const save = useSave();
  const { products, combos, loading, reload } = useCatalog();
  const [editing, setEditing] = useState<Combo | null>(null);
  if (loading) return <div className="skeleton h-96" />;

  const submit = async (c: Combo) => {
    const { id, items, boxed_stock: _b, ...rest } = c; // eslint-disable-line @typescript-eslint/no-unused-vars
    const row = { ...rest, slug: rest.slug || slugify(rest.name_en) };
    const res = id ? await sb.from("combos").update(row).eq("id", id).select("id").single() : await sb.from("combos").insert(row).select("id").single();
    if (res.error) return save(res.error);
    const comboId = res.data.id;
    const del = await sb.from("combo_items").delete().eq("combo_id", comboId);
    if (del.error) return save(del.error);
    const ins = await sb.from("combo_items").insert(items.map((i) => ({ combo_id: comboId, ...i })));
    save(ins.error);
    if (!ins.error) {
      reload();
      setEditing(null);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <ul className="space-y-2 lg:col-span-4">
        {combos.map((c) => (
          <li key={c.id}>
            <button onClick={() => setEditing(c)} className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ${editing?.id === c.id ? "bg-maroon text-paper" : "bg-paper-2/60 hover:bg-paper-3/60"}`}>
              <span className="display text-2xl">
                {c.name_en}
                {c.offer_label && <span className="ml-2 rounded-full bg-turmeric px-2 py-0.5 align-middle text-xs text-ink">Offer</span>}
              </span>
              <span className="price">{formatINR(c.price + c.packing_charge)}</span>
            </button>
          </li>
        ))}
        <li>
          <button
            className="w-full rounded-2xl px-4 py-3 text-left text-sm text-ink-soft hover:bg-paper-2"
            onClick={() => setEditing({ id: "", slug: "", name_en: `Combo ${combos.length + 1}`, name_ta: `காம்போ ${combos.length + 1}`, price: 0, packing_charge: 20, image: null, boxed_stock: 0, low_stock_boxes: 5, active: true, sort: combos.length + 1, offer_label: null, offer_label_ta: null, items: [] })}
          >
            + New combo
          </button>
        </li>
      </ul>
      <div className="lg:col-span-8">
        {editing ? <ComboForm key={editing.id || "new"} combo={editing} products={products} onSave={submit} /> : <p className="text-ink-soft">Pick a combo to change its price, packing charge or contents.</p>}
      </div>
    </div>
  );
}

function ComboForm({ combo, products, onSave }: { combo: Combo; products: Product[]; onSave: (c: Combo) => void }) {
  const [c, setC] = useState(combo);
  const value = c.items.reduce((s, i) => s + (products.find((p) => p.id === i.product_id)?.price_per_kg ?? 0) * i.grams / 1000, 0);
  return (
    <div className="space-y-4 rounded-[22px] bg-paper-2/40 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name (English)" value={c.name_en} onChange={(v) => setC({ ...c, name_en: v })} />
        <Field label="Name (Tamil)" value={c.name_ta} onChange={(v) => setC({ ...c, name_ta: v })} tamil />
        <Field label="Price ₹ (items)" type="number" value={String(c.price)} onChange={(v) => setC({ ...c, price: Number(v) })} />
        <Field label="Packing ₹" type="number" value={String(c.packing_charge)} onChange={(v) => setC({ ...c, packing_charge: Number(v) })} />
        <Field label="Low-stock alert below (boxes)" type="number" value={String(c.low_stock_boxes)} onChange={(v) => setC({ ...c, low_stock_boxes: Number(v) })} />
        <label className="flex items-center gap-2 self-end pb-3 text-sm">
          <input type="checkbox" checked={c.active} onChange={(e) => setC({ ...c, active: e.target.checked })} className="h-5 w-5" /> Active
        </label>
        <Field label="Offer badge (English) · empty = normal combo" value={c.offer_label ?? ""} onChange={(v) => setC({ ...c, offer_label: v || null })} />
        <Field label="Offer badge (Tamil)" value={c.offer_label_ta ?? ""} onChange={(v) => setC({ ...c, offer_label_ta: v || null })} tamil />
      </div>
      {c.offer_label && <p className="-mt-2 text-sm text-ink-soft">Offers are showcased at the top of the home page, menu and gift boxes, with the usual price struck through.</p>}
      <div>
        <p className="label">Contents</p>
        <ul className="space-y-2">
          {c.items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <select className="field !min-h-10 flex-1" value={it.product_id} onChange={(e) => setC({ ...c, items: c.items.map((x, k) => (k === i ? { ...x, product_id: e.target.value } : x)) })}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name_en}
                  </option>
                ))}
              </select>
              <input className="field lnum !min-h-10 !w-28" type="number" value={it.grams} onChange={(e) => setC({ ...c, items: c.items.map((x, k) => (k === i ? { ...x, grams: Number(e.target.value) } : x)) })} aria-label="grams" />
              <span className="self-center text-sm text-ink-soft">g</span>
              <button className="chip !min-h-10 text-kumkum" onClick={() => setC({ ...c, items: c.items.filter((_, k) => k !== i) })}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button className="ink-link mt-3 text-sm" onClick={() => products[0] && setC({ ...c, items: [...c.items, { product_id: products[0].id, grams: 250 }] })}>
          + Add item
        </button>
        <p className="mt-3 text-sm text-ink-soft">
          At per-kg prices these items are worth <span className="price">{formatINR(Math.round(value * 100) / 100)}</span>; the combo charges <span className="price">{formatINR(c.price)}</span> + <span className="price">{formatINR(c.packing_charge)}</span> packing.
        </p>
      </div>
      <button className="btn" disabled={!c.items.length || new Set(c.items.map((i) => i.product_id)).size !== c.items.length} onClick={() => onSave(c)}>
        Save combo
      </button>
    </div>
  );
}

/* ─────────── staff ─────────── */

function StaffTab() {
  const sb = supabaseBrowser()!;
  const save = useSave();
  const [rows, setRows] = useState<{ id: string; email: string | null; phone: string | null; name: string | null; role: string }[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "owner">("staff");
  const [pending, setPending] = useState<{ email: string; role: string }[]>([]);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const load = () => {
    sb.from("profiles").select("id, email, phone, name, role").in("role", ["staff", "owner"]).then(({ data }) => setRows(data ?? []));
    sb.from("pending_roles").select("email, role").then(({ data }) => setPending(data ?? []));
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setRoleFor = async (e: string, r: string) => {
    const { error } = await sb.rpc("set_role", { p_email: e, p_role: r });
    save(error, "Updated");
    if (!error) load();
  };

  return (
    <div className="max-w-2xl">
      <p className="mb-4 text-sm text-ink-soft">
        Staff can bill walk-ins, update stock, move orders along and open/close online orders. Only owners see reports and settings. Add people by the <b>email they log in with</b> (email code or Google). You can add someone before their first login; the access applies when they sign in.
      </p>
      <ul className="divide-y divide-rule rounded-[22px] bg-paper-2/60">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate">{r.name ?? "—"}</span>
              <span className="block truncate text-sm text-ink-soft">
                {r.email ?? "—"} {r.phone && <span className="lnum">· {r.phone.slice(-10)}</span>}
              </span>
            </span>
            <span className="smallcaps text-xs">{r.role}</span>
            {r.email && (
              <button className="chip !min-h-9 !text-xs text-kumkum" onClick={() => confirm(`Remove ${r.email}'s ${r.role} access?`) && setRoleFor(r.email!, "customer")}>
                Remove
              </button>
            )}
          </li>
        ))}
        {pending.map((r) => (
          <li key={r.email} className="flex items-center gap-3 px-4 py-3 text-ink-soft">
            <span className="min-w-0 flex-1 truncate">
              <span className="text-sm">{r.email}</span> <span className="text-xs">· waiting for first login</span>
            </span>
            <span className="smallcaps text-xs">{r.role}</span>
            <button className="chip !min-h-9 !text-xs text-kumkum" onClick={() => setRoleFor(r.email, "customer")}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) setRoleFor(email.trim(), role).then(() => setEmail(""));
        }}
      >
        <div className="min-w-56 flex-1">
          <label className="label">Email</label>
          <input className="field" type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </div>
        {(["staff", "owner"] as const).map((r) => (
          <button type="button" key={r} className="chip !min-h-[52px]" aria-pressed={role === r} onClick={() => setRole(r)}>
            {r}
          </button>
        ))}
        <button className="btn" disabled={!valid}>
          Grant access
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", tamil }: { label: string; value: string; onChange: (v: string) => void; type?: string; tamil?: boolean }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className={`field ${type === "number" ? "lnum" : ""} ${tamil ? "tamil" : ""}`} type={type} step={type === "number" ? "any" : undefined} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
