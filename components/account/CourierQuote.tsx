"use client";

import Link from "next/link";
import Script from "next/script";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/site/StoreProvider";
import { WA_PATH } from "@/components/site/WhatsAppButton";
import { fireConfetti } from "@/components/motion/Confetti";
import { chime } from "@/lib/chime";
import { nameOf } from "@/lib/i18n";
import { whatsappUrl } from "@/lib/links";
import { formatINR, formatWeight } from "@/lib/pricing";
import { openRazorpay } from "@/lib/razorpay-client";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { CourierRequest } from "@/lib/types";
import { PushPrompt } from "./OrderStatus";

/** A courier delivery waiting on the shop's charge, then on the customer's approval and payment. */
export function CourierQuote({ initial, requested, nonce }: { initial: CourierRequest; requested: boolean; nonce?: string }) {
  const t = useTranslations("courierQuote");
  const tw = useTranslations("orders2");
  const terr = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const { products, combos, settings } = useStore();
  const [r, setR] = useState(initial);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastStatus = useRef(initial.status);

  useEffect(() => {
    if (requested) setTimeout(() => fireConfetti({ x: 0.5, y: 0.3 }), 500);
  }, [requested]);

  // the shop's quote arrives live while the page is open
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const ch = sb
      .channel(`quote-${initial.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "courier_requests", filter: `id=eq.${initial.id}` }, ({ new: row }) => {
        if (row.status !== lastStatus.current) {
          lastStatus.current = row.status;
          chime();
        }
        setR((o) => ({ ...o, ...(row as Partial<CourierRequest>), courier_fee: row.courier_fee === null ? null : Number(row.courier_fee), subtotal: Number(row.subtotal), packing: Number(row.packing) }));
      })
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [initial.id]);

  const total = r.subtotal + r.packing + (r.courier_fee ?? 0);

  const act = async (action: "accept" | "decline") => {
    if (action === "decline" && !confirm(t("declineConfirm"))) return;
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/courier-requests/${r.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const json = await res.json();
    if (!res.ok) {
      setBusy(null);
      const key = json.error as string;
      return setError(terr.has(key) ? terr(key, { item: json.item ?? "" }) : t.has(`err.${key}`) ? t(`err.${key}`) : terr("generic"));
    }
    if (action === "decline") {
      setBusy(null);
      return setR((o) => ({ ...o, status: "declined" }));
    }
    if (!json.razorpay) return router.push(`/orders/${json.order.id}`);
    const opened = openRazorpay(json, settings.shop_name, {
      paid: () => router.push(`/orders/${json.order.id}?placed=1`),
      dismissed: () => (setBusy(null), router.refresh()),
    });
    if (!opened) {
      setBusy(null);
      setError(terr("generic"));
    }
  };

  const stage = r.status === "requested" ? 0 : r.status === "quoted" ? 1 : 2;
  const closed = r.status === "declined" || r.status === "rejected";

  return (
    <div className="grid gap-14 lg:grid-cols-12">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" nonce={nonce} />
      <div className="lg:col-span-7">
        {requested && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <p className="display-italic text-5xl text-maroon">{t("sent")}</p>
            <p className="mt-2 text-ink-soft">{t("sentSub")}</p>
          </motion.div>
        )}

        {closed ? (
          <div className="rounded-2xl bg-kumkum/10 px-5 py-4 text-kumkum">
            <p className="font-medium">{t(`status.${r.status}`)}</p>
            {r.shop_note && <p className="mt-1 text-sm">{r.shop_note}</p>}
          </div>
        ) : (
          <ol className="relative ml-3">
            <span className="absolute left-0 top-2 h-[calc(100%-1rem)] w-px bg-rule" aria-hidden />
            {(["requested", "quoted", "accepted"] as const).map((s, i) => {
              const done = i <= stage;
              const current = i === stage;
              return (
                <li key={s} className="relative pb-10 pl-10 last:pb-0" aria-current={current ? "step" : undefined}>
                  <motion.span
                    className={`absolute -left-[7px] top-1.5 h-[15px] w-[15px] rounded-full border-2 ${done ? "border-ink bg-turmeric" : "border-rule bg-paper"}`}
                    animate={current ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                    transition={current ? { repeat: Infinity, duration: 2 } : {}}
                  />
                  <p className={`display text-[clamp(1.8rem,3vw,2.6rem)] leading-tight ${done ? "" : "text-ink/30"}`}>{t(`status.${s}`)}</p>
                  {current && <p className="mt-1 max-w-md text-sm text-ink-soft">{t(`hint.${s}`)}</p>}
                </li>
              );
            })}
          </ol>
        )}

        {r.status === "quoted" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-12 rounded-[24px] bg-ink p-6 text-paper md:p-8">
            <p className="smallcaps text-turmeric-soft">{t("ready")}</p>
            <p className="display mt-2 text-5xl">{formatINR(total)}</p>
            <p className="mt-2 text-sm text-paper/75">{t("readySub", { fee: formatINR(r.courier_fee ?? 0) })}</p>
            {r.shop_note && <p className="mt-3 rounded-xl bg-paper/10 px-4 py-3 text-sm italic">“{r.shop_note}”</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn btn-turmeric shine" disabled={busy !== null} onClick={() => act("accept")}>
                {busy === "accept" ? t("opening") : t("accept", { amount: formatINR(total) })}
              </button>
              <button className="btn btn-ghost !text-paper !shadow-[inset_0_0_0_1px_rgba(255,255,255,.35)]" disabled={busy !== null} onClick={() => act("decline")}>
                {t("decline")}
              </button>
            </div>
          </motion.div>
        )}

        {r.status === "accepted" && r.order_id && (
          <div className="mt-12 flex flex-wrap gap-3">
            <Link href={`/orders/${r.order_id}`} className="btn">
              {t("viewOrder")}
            </Link>
            <button className="btn btn-ghost" disabled={busy !== null} onClick={() => act("accept")}>
              {busy === "accept" ? t("opening") : t("payAgain")}
            </button>
          </div>
        )}
        {r.status === "requested" && (
          <button className="ink-link mt-10 text-sm text-ink-soft" disabled={busy !== null} onClick={() => act("decline")}>
            {t("withdraw")}
          </button>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-kumkum">
            {error}
          </p>
        )}
      </div>

      <aside className="space-y-4 lg:col-span-4 lg:col-start-9">
        {(r.status === "requested" || r.status === "quoted") && <PushPrompt />}
        <div className="rounded-[6px] bg-[#fbf6ec] p-6 shadow-[0_24px_50px_-28px_rgba(42,26,18,.5)]">
          <p className="smallcaps text-ink-mute">{r.short_code}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {r.items.map((it, i) => {
              const item = it.type === "product" ? products.find((p) => p.id === it.id) : combos.find((c) => c.id === it.id);
              return (
                <li key={i} className="flex gap-2">
                  <span className="flex-1">
                    {item ? nameOf(item, locale) : "—"}
                    <span className="text-ink-mute">
                      {it.type === "product" ? ` · ${formatWeight(it.grams)}` : ""} × {it.qty}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-ink-mute">
            {t("parcel", { weight: formatWeight(r.weight_g) })}
            {r.distance_km ? ` · ${r.distance_km} km` : ""}
          </p>
          <p className="mt-1 text-xs text-ink-mute">{r.address.line}</p>
          <dl className="mt-4 space-y-1 border-t border-dashed border-ink/25 pt-3 text-sm text-ink-soft">
            <div className="flex justify-between">
              <dt>{t("items")}</dt>
              <dd className="price">{formatINR(r.subtotal)}</dd>
            </div>
            {r.packing > 0 && (
              <div className="flex justify-between">
                <dt>{t("packing")}</dt>
                <dd className="price">{formatINR(r.packing)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>
                {t("courier")}
                {r.courier_name ? ` · ${r.courier_name}` : ""}
              </dt>
              <dd className="price">{r.courier_fee === null ? t("tbd") : formatINR(r.courier_fee)}</dd>
            </div>
          </dl>
          <div className="mt-3 flex items-end justify-between border-t border-ink/60 pt-3">
            <span className="smallcaps">{t("total")}</span>
            <span className="display price text-3xl">{r.courier_fee === null ? `${formatINR(r.subtotal + r.packing)}+` : formatINR(total)}</span>
          </div>
        </div>
        {whatsappUrl(settings.whatsapp_number ?? settings.shop_phone) && (
          <a
            href={whatsappUrl(settings.whatsapp_number ?? settings.shop_phone, tw("waOrder", { code: r.short_code }))!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl bg-[#25D366]/10 px-4 py-3 text-sm font-medium text-[#128C7E] transition-colors hover:bg-[#25D366]/20"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#25D366" aria-hidden>
              <path d={WA_PATH} />
            </svg>
            {tw("askWa")}
          </a>
        )}
      </aside>
    </div>
  );
}
