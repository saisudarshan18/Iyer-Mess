"use client";

import Link from "next/link";
import Script from "next/script";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { ProductArt } from "@/components/art/SweetGlyph";
import { useStore } from "@/components/site/StoreProvider";
import { useCart } from "@/lib/cart-store";
import { LOCAL_PAYMENTS, TAKEAWAY_PAYMENTS, type Quote } from "@/lib/delivery";
import { nameOf } from "@/lib/i18n";
import { cartTotals, formatINR, formatWeight } from "@/lib/pricing";
import { LabelIcon } from "@/components/account/AccountClient";
import { openRazorpay } from "@/lib/razorpay-client";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { AddressLabel, PaymentMode, SavedAddress } from "@/lib/types";
import { AddressPicker, type PickedAddress } from "./AddressPicker";

type Slot = { id: string; label: string; start: string; end: string; remaining: number };

/** Dates from today, in IST, for the next `days` days. */
function upcomingDates(days: number) {
  const base = new Date(Date.now() + 5.5 * 3600_000);
  return Array.from({ length: days + 1 }, (_, i) => {
    const d = new Date(base.getTime() + i * 86400_000);
    return d.toISOString().slice(0, 10);
  });
}

export function CheckoutClient({
  defaults,
  nonce,
  userId,
  saved = [],
  preferred = null,
}: {
  defaults: { name: string; email: string; phone: string };
  nonce?: string;
  userId?: string;
  saved?: SavedAddress[];
  preferred?: PaymentMode | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { products, combos, settings } = useStore();
  const { lines, clear } = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [mode, setMode] = useState<"delivery" | "takeaway">("delivery");
  // a saved address (by id), or "new" to enter one; starts on the default address
  const [chosen, setChosen] = useState<string>(saved[0]?.id ?? "new");
  const fromSaved = (a: SavedAddress): PickedAddress => ({ line: a.line, landmark: a.landmark ?? "", lat: a.lat, lng: a.lng, place_id: a.place_id ?? undefined });
  const [address, setAddress] = useState<PickedAddress | null>(saved[0] ? fromSaved(saved[0]) : null);
  const freeLabels = (["home", "work", "other"] as AddressLabel[]).filter((l) => l === "other" || !saved.some((s) => s.label === l));
  const [saveAs, setSaveAs] = useState<AddressLabel | null>(freeLabels[0] ?? null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [date, setDate] = useState(upcomingDates(0)[0]);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMode | null>(null);
  const [name, setName] = useState(defaults.name);
  const [email, setEmail] = useState(defaults.email);
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = cartTotals(lines, products, combos);
  const isCourier = mode === "delivery" && quote?.kind === "courier";
  const needsSlot = mode === "takeaway" || quote?.kind === "local";
  const fee = mode === "delivery" && quote?.kind === "local" ? quote.fee : 0;
  const total = totals.subtotal + totals.packing + fee;

  // price delivery whenever the pin moves
  useEffect(() => {
    if (mode !== "delivery" || !address) return setQuote(null);
    let cancelled = false;
    setQuoting(true);
    fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: address.lat, lng: address.lng }) })
      .then((r) => r.json())
      .then((q) => !cancelled && setQuote(q.error ? null : q))
      .finally(() => !cancelled && setQuoting(false));
    return () => {
      cancelled = true;
    };
  }, [mode, address?.lat, address?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // load slots for the chosen day
  useEffect(() => {
    if (!needsSlot) return setSlots(null);
    const kind = mode === "takeaway" ? "takeaway" : "delivery_local";
    setSlots(null);
    setSlotId(null);
    fetch(`/api/slots?date=${date}&kind=${kind}`)
      .then((r) => r.json())
      .then((j) => setSlots(j.slots ?? []));
  }, [date, needsSlot, mode]);

  const payments: PaymentMode[] = useMemo(() => {
    if (mode === "takeaway") return TAKEAWAY_PAYMENTS;
    // courier: nothing to pay until the shop has quoted the courier charge
    if (!quote || quote.kind !== "local") return [];
    return LOCAL_PAYMENTS;
  }, [mode, quote]);
  useEffect(() => {
    if (payment && !payments.includes(payment)) setPayment(null);
    // pre-select the customer's preferred method when this order allows it
    if (!payment && preferred && payments.includes(preferred)) setPayment(preferred);
  }, [payments, payment]);

  const payLabel = (p: PaymentMode) => {
    if (p === "upi_online") return t("pay.upi_online");
    if (mode === "takeaway") return p === "cash" ? t("pay.cash_on_pickup") : t("pay.upi_on_pickup");
    return p === "cash" ? t("pay.cash_on_delivery") : t("pay.upi_on_delivery");
  };

  const ready =
    lines.length > 0 &&
    settings.orders_open &&
    name.trim() &&
    (payment || isCourier) &&
    (mode === "takeaway" || (address && quote && quote.kind !== "rejected")) &&
    (!needsSlot || slotId);

  const saveAddress = async () => {
    // remember a newly entered delivery address for next time
    if (mode === "delivery" && chosen === "new" && saveAs && address && userId) {
      await supabaseBrowser()
        ?.from("addresses")
        .insert({ user_id: userId, label: saveAs, line: address.line, landmark: address.landmark || null, lat: address.lat, lng: address.lng, place_id: address.place_id ?? null, is_default: saved.length === 0 })
        .then(({ error }) => error && console.warn("address not saved", error.message));
    }
  };

  const showError = (json: { error?: string; item?: string }) => {
    const key = `errors.${json.error}`;
    setError(t.has(key) ? t(key, { item: json.item ?? "" }) : t.has(`checkout.rejected.${json.error}`) ? t(`checkout.rejected.${json.error}`) : t("errors.generic"));
  };

  /** Beyond the local radius: send the cart and address to the shop for a courier quote. */
  const requestCourier = async () => {
    if (!ready || !address) return;
    setPlacing(true);
    setError(null);
    const res = await fetch("/api/courier-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: lines.map((l) => (l.type === "product" ? { type: "product", id: l.id, grams: l.grams, qty: l.qty } : { type: "combo", id: l.id, qty: l.qty })),
        address: { line: address.line, landmark: address.landmark || undefined, lat: address.lat, lng: address.lng, place_id: address.place_id },
        name: name.trim(),
        email: email.trim(),
        notes: notes.trim() || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setPlacing(false);
      return showError(json);
    }
    await saveAddress();
    clear();
    router.push(`/orders/${json.request.id}?requested=1`);
  };

  const place = async () => {
    if (isCourier) return requestCourier();
    if (!ready || !payment) return;
    setPlacing(true);
    setError(null);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: lines.map((l) => (l.type === "product" ? { type: "product", id: l.id, grams: l.grams, qty: l.qty } : { type: "combo", id: l.id, qty: l.qty })),
        mode,
        address: mode === "delivery" && address ? { line: address.line, landmark: address.landmark || undefined, lat: address.lat, lng: address.lng, place_id: address.place_id } : undefined,
        slot_date: needsSlot ? date : undefined,
        slot_id: needsSlot ? slotId : undefined,
        payment_mode: payment,
        name: name.trim(),
        email: email.trim(),
        notes: notes.trim() || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setPlacing(false);
      return showError(json);
    }
    const orderId = json.order.id as string;
    await saveAddress();
    if (!json.razorpay) {
      clear();
      router.push(`/orders/${orderId}?placed=1`);
      return;
    }
    const opened = openRazorpay(json, settings.shop_name, {
      paid: () => (clear(), router.push(`/orders/${orderId}?placed=1`)),
      dismissed: () => (clear(), router.push(`/orders/${orderId}`)),
    });
    if (!opened) {
      setPlacing(false);
      setError(t("errors.generic"));
    }
  };

  if (!mounted) return <div className="skeleton mx-[var(--gutter)] mt-40 h-[60vh]" />;

  if (lines.length === 0)
    return (
      <div className="grid min-h-[70vh] place-items-center px-[var(--gutter)] pt-28 text-center">
        <div>
          <p className="display-italic text-4xl text-ink-soft">{t("cart.empty")}</p>
          <Link href="/menu" className="btn mt-8">
            {t("cart.emptyCta")}
          </Link>
        </div>
      </div>
    );

  return (
    <section className="px-[var(--gutter)] pb-28 pt-32 md:pt-40">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" nonce={nonce} />
      <h1 className="display text-[clamp(3.5rem,9vw,8rem)]">{t("checkout.title")}</h1>
      {!settings.orders_open && <p className="mt-6 rounded-2xl bg-maroon px-5 py-4 text-paper">{t("closed.checkout")}</p>}

      <div className="mt-14 grid gap-14 lg:grid-cols-12">
        <div className="space-y-14 lg:col-span-7">
          <Step n="01" title={t("checkout.how")}>
            <div className="grid grid-cols-2 gap-3" role="radiogroup">
              {(["delivery", "takeaway"] as const).map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={`relative overflow-hidden rounded-[20px] p-5 text-left transition-colors ${mode === m ? "text-paper" : "shadow-[inset_0_0_0_1px_var(--rule)] hover:shadow-[inset_0_0_0_1px_var(--ink)]"}`}
                >
                  {mode === m && <motion.span layoutId="mode-pill" className="absolute inset-0 bg-ink" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  <span className="display relative block text-3xl">{m === "delivery" ? t("checkout.delivery") : t("checkout.takeaway")}</span>
                  <span className="relative mt-1 block text-sm opacity-70">{m === "delivery" ? t("delivery.courierT") : t("delivery.takeaway")}</span>
                </button>
              ))}
            </div>
          </Step>

          <AnimatePresence initial={false}>
            {mode === "delivery" && (
              <motion.div key="addr" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <Step n="02" title={t("checkout.address")}>
                  {saved.length > 0 && (
                    <div className="mb-6">
                      <p className="label">{t("checkout2.saved")}</p>
                      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
                        {saved.map((a) => (
                          <button
                            key={a.id}
                            role="radio"
                            aria-checked={chosen === a.id}
                            onClick={() => (setChosen(a.id), setAddress(fromSaved(a)))}
                            className={`flex items-start gap-3 rounded-[18px] p-4 text-left transition-[box-shadow,background-color] ${chosen === a.id ? "bg-turmeric/30 shadow-[inset_0_0_0_2px_var(--ink)]" : "shadow-[inset_0_0_0_1px_var(--rule)] hover:shadow-[inset_0_0_0_1px_var(--ink)]"}`}
                          >
                            <LabelIcon label={a.label} className="mt-0.5 shrink-0 text-maroon" />
                            <span className="min-w-0">
                              <span className="block font-medium">{t(`account.${a.label}`)}</span>
                              <span className="line-clamp-2 text-sm text-ink-soft">{a.line}</span>
                            </span>
                          </button>
                        ))}
                        <button
                          role="radio"
                          aria-checked={chosen === "new"}
                          onClick={() => (setChosen("new"), setAddress(null))}
                          className={`rounded-[18px] p-4 text-left ${chosen === "new" ? "bg-ink text-paper" : "shadow-[inset_0_0_0_1px_var(--rule)] hover:shadow-[inset_0_0_0_1px_var(--ink)]"}`}
                        >
                          + {t("checkout2.newAddr")}
                        </button>
                      </div>
                    </div>
                  )}
                  {chosen === "new" && (
                    <>
                      <AddressPicker value={address} onChange={setAddress} center={settings.shop_lat !== null && settings.shop_lng !== null ? { lat: settings.shop_lat, lng: settings.shop_lng } : null} />
                      {address && userId && (
                        <div className="mt-5">
                          <p className="label">{t("checkout2.saveAs")}</p>
                          <div className="flex flex-wrap gap-2" role="radiogroup">
                            {freeLabels.map((l) => (
                              <button key={l} role="radio" aria-checked={saveAs === l} onClick={() => setSaveAs(l)} className="chip">
                                <LabelIcon label={l} />
                                {t(`account.${l}`)}
                              </button>
                            ))}
                            <button role="radio" aria-checked={saveAs === null} onClick={() => setSaveAs(null)} className="chip">
                              {t("checkout2.dontSave")}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <QuoteBadge quote={quote} quoting={quoting} />
                </Step>
              </motion.div>
            )}
          </AnimatePresence>

          {needsSlot && (
            <Step n={mode === "delivery" ? "03" : "02"} title={t("checkout.when")}>
              <p className="label">{t("checkout.date")}</p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
                {upcomingDates(settings.booking_days_ahead).map((d) => {
                  const dt = new Date(d + "T00:00:00");
                  return (
                    <button key={d} className="chip shrink-0 flex-col !items-center !gap-0 !rounded-2xl !px-4 !py-2" aria-pressed={date === d} onClick={() => setDate(d)}>
                      <span className="text-[11px] uppercase tracking-wider opacity-70">{dt.toLocaleDateString(locale === "ta" ? "ta-IN" : "en-IN", { weekday: "short" })}</span>
                      <span className="lnum text-lg">{dt.getDate()}</span>
                    </button>
                  );
                })}
              </div>
              <p className="label mt-6">{t("checkout.slot")}</p>
              {slots === null ? (
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="skeleton h-12 w-36" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-ink-soft">{t("checkout.noSlots")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <button key={s.id} className="chip" aria-pressed={slotId === s.id} disabled={s.remaining <= 0} onClick={() => setSlotId(s.id)}>
                      {s.label}
                      <span className="text-xs opacity-60">{s.remaining <= 0 ? t("checkout.full") : t("checkout.left", { n: s.remaining })}</span>
                    </button>
                  ))}
                </div>
              )}
            </Step>
          )}

          <Step n={String(mode === "delivery" ? (needsSlot ? 4 : 3) : 3).padStart(2, "0")} title={t("checkout.you")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="name">{t("checkout.name")}</label>
                <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              <div>
                <label className="label" htmlFor="email">{t("checkout.email")}</label>
                <input id="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="notes">{t("checkout.notes")}</label>
                <textarea id="notes" className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
              </div>
            </div>
          </Step>

          <Step n={String(mode === "delivery" ? (needsSlot ? 5 : 4) : 4).padStart(2, "0")} title={t("checkout.pay")}>
            {isCourier ? (
              <ol className="space-y-3 rounded-[18px] bg-paper-2 p-5 text-sm">
                {(["s1", "s2", "s3"] as const).map((k, i) => (
                  <li key={k} className="flex gap-3">
                    <span className="lnum grid h-6 w-6 shrink-0 place-items-center rounded-full bg-maroon text-xs text-paper">{i + 1}</span>
                    <span>{t(`courierQuote.${k}`)}</span>
                  </li>
                ))}
              </ol>
            ) : payments.length === 0 ? (
              <p className="text-ink-soft">{mode === "delivery" ? t("checkout.address") + " ↑" : ""}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
                {payments.map((p) => (
                  <button
                    key={p}
                    role="radio"
                    aria-checked={payment === p}
                    onClick={() => setPayment(p)}
                    className={`rounded-[18px] p-4 text-left transition-[box-shadow,background-color] ${payment === p ? "bg-turmeric shadow-[inset_0_0_0_2px_var(--ink)]" : "shadow-[inset_0_0_0_1px_var(--rule)] hover:shadow-[inset_0_0_0_1px_var(--ink)]"}`}
                  >
                    <span className="block font-medium">{payLabel(p)}</span>
                  </button>
                ))}
              </div>
            )}
          </Step>
        </div>

        {/* summary */}
        <aside className="lg:col-span-4 lg:col-start-9">
          <div className="sticky top-28 rounded-[28px] bg-paper-2 p-6">
            <h2 className="display text-3xl">{t("checkout.summary")}</h2>
            <ul className="mt-5 space-y-3">
              {totals.lines.map(({ line, amount, packing }) => {
                const item = line.type === "product" ? products.find((p) => p.id === line.id) : combos.find((c) => c.id === line.id);
                if (!item) return null;
                return (
                  <li key={line.key} className="flex items-center gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-paper">
                      {line.type === "product" ? <ProductArt slug={item.slug} image={item.image} alt="" className="h-10 w-10" /> : <span className="display text-xl text-maroon">{item.slug.slice(-1)}</span>}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block truncate">{nameOf(item, locale)}</span>
                      <span className="text-ink-soft">
                        {line.type === "product" ? formatWeight(line.grams) : ""} × {line.qty}
                      </span>
                    </span>
                    <span className="price text-sm">{formatINR(amount + packing)}</span>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-5 space-y-1.5 border-t border-rule pt-4 text-sm">
              <Row k={t("cart.subtotal")} v={formatINR(totals.subtotal)} />
              {totals.packing > 0 && <Row k={t("cart.packing")} v={formatINR(totals.packing)} />}
              {mode === "delivery" && <Row k={t("checkout.fee")} v={quote?.kind === "local" ? formatINR(quote.fee) : isCourier ? t("courierQuote.tbd") : "—"} />}
            </dl>
            <div className="mt-4 flex items-end justify-between border-t border-ink/50 pt-4">
              <span className="smallcaps">{t("checkout.total")}</span>
              <motion.span key={total} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="display price text-4xl">
                {formatINR(total)}
              </motion.span>
            </div>
            {isCourier && <p className="mt-1 text-right text-xs text-ink-mute">{t("courierQuote.plus")}</p>}
            <button className="btn shine mt-6 w-full" disabled={!ready || placing} onClick={place}>
              {placing ? t("checkout.placing") : isCourier ? t("courierQuote.request") : payment === "upi_online" ? t("checkout.payNow", { amount: formatINR(total) }) : t("checkout.place")}
            </button>
            {error && (
              <p role="alert" className="mt-3 text-sm text-kumkum">
                {error}
              </p>
            )}
            {defaults.phone && <p className="lnum mt-4 text-xs text-ink-mute">{defaults.phone}</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-rule pt-6">
      <div className="mb-6 flex items-baseline gap-4">
        <span className="lnum text-sm text-kumkum">{n}</span>
        <h2 className="display text-[clamp(2rem,3.5vw,3rem)]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="price">{v}</dd>
    </div>
  );
}

function QuoteBadge({ quote, quoting }: { quote: Quote | null; quoting: boolean }) {
  const t = useTranslations("checkout");
  const tq = useTranslations("courierQuote");
  const locale = useLocale();
  if (quoting) return <p className="mt-4 text-sm text-ink-soft">{t("checking")}</p>;
  if (!quote) return null;
  if (quote.kind === "rejected") return <p className="mt-4 rounded-xl bg-kumkum/10 px-4 py-3 text-sm text-kumkum">{t(`rejected.${quote.reason}`)}</p>;
  if (quote.kind === "courier")
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl bg-turmeric/20 px-4 py-3 text-sm">
        <span className="font-medium text-maroon">{t("courier", { km: quote.distance_km })}</span>
        {quote.approx && <span className="ml-2 text-xs text-ink-soft">({t("approx")})</span>}
        <span className="block text-ink-soft">{tq("badge")}</span>
      </motion.div>
    );
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-leaf/10 px-4 py-3 text-sm">
      <span>
        <span className="font-medium text-leaf">{t("local", { km: quote.distance_km })}</span>
        {quote.approx && <span className="ml-2 text-xs text-ink-soft">({t("approx")})</span>}
        <span className="block text-ink-soft">{locale === "ta" && quote.eta_ta ? quote.eta_ta : quote.eta_en}</span>
      </span>
      <span className="price text-base">{formatINR(quote.fee)}</span>
    </motion.div>
  );
}
