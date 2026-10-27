"use client";

import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { chime } from "@/lib/chime";
import { whatsappUrl } from "@/lib/links";
import { enablePush, pushState, type PushState } from "@/lib/push-client";
import { useStore } from "@/components/site/StoreProvider";
import { WA_PATH } from "@/components/site/WhatsAppButton";
import { fireConfetti } from "@/components/motion/Confetti";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatINR, formatWeight } from "@/lib/pricing";
import type { Order, OrderItem, OrderStatus as Status } from "@/lib/types";

/** The path an order travels, by how it's fulfilled. */
export function stagesFor(order: Pick<Order, "fulfilment" | "payment_mode">): Status[] {
  const tail: Record<Order["fulfilment"], Status[]> = {
    delivery_local: ["confirmed", "preparing", "out_for_delivery", "completed"],
    courier: ["confirmed", "preparing", "shipped", "completed"],
    takeaway: ["confirmed", "preparing", "ready", "completed"],
    counter: ["completed"],
  };
  return order.payment_mode === "upi_online" ? ["pending_payment", ...tail[order.fulfilment]] : tail[order.fulfilment];
}

export function OrderStatus({ initial, items, placed }: { initial: Order; items: OrderItem[]; placed: boolean }) {
  const t = useTranslations("orders");
  const locale = useLocale();
  const [order, setOrder] = useState(initial);
  const { settings } = useStore();
  const tw = useTranslations("orders2");
  const lastStatus = useRef(initial.status);

  useEffect(() => {
    if (placed) setTimeout(() => fireConfetti({ x: 0.5, y: 0.3 }), 500);
  }, [placed]);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const ch = sb
      .channel(`order-${initial.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${initial.id}` }, ({ new: row }) =>
        setOrder((o) => {
          // chime when the status moves while the page is open
          if (row.status !== lastStatus.current) {
            lastStatus.current = row.status;
            chime();
          }
          return { ...o, ...(row as Partial<Order>), total: Number(row.total), delivery_fee: Number(row.delivery_fee) };
        }),
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [initial.id]);

  const stages = stagesFor(order);
  const cancelled = order.status === "cancelled";
  const at = Math.max(0, stages.indexOf(order.status));
  const progress = stages.length > 1 ? at / (stages.length - 1) : 1;

  return (
    <div className="grid gap-14 lg:grid-cols-12">
      <div className="lg:col-span-7">
        {placed && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <p className="display-italic text-5xl text-maroon">{t("placed")}</p>
            <p className="mt-2 text-ink-soft">{order.status === "pending_payment" ? t("awaiting") : t("thanks")}</p>
          </motion.div>
        )}

        {cancelled ? (
          <p className="rounded-2xl bg-kumkum/10 px-5 py-4 text-kumkum">{t("status.cancelled")}</p>
        ) : (
          // vertical "beam": the ink line fills down to the current stage (Magic UI "Animated Beam" idea)
          <ol className="relative ml-3">
            <span className="absolute left-0 top-2 h-[calc(100%-1rem)] w-px bg-rule" aria-hidden />
            <motion.span
              className="absolute left-0 top-2 w-px origin-top bg-gradient-to-b from-kumkum via-turmeric to-leaf"
              style={{ height: "calc(100% - 1rem)" }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: progress }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              aria-hidden
            />
            {stages.map((s, i) => {
              const done = i <= at;
              const current = i === at;
              return (
                <li key={s} className="relative pb-10 pl-10 last:pb-0" aria-current={current ? "step" : undefined}>
                  <motion.span
                    className={`absolute -left-[7px] top-1.5 h-[15px] w-[15px] rounded-full border-2 ${done ? "border-ink bg-turmeric" : "border-rule bg-paper"}`}
                    animate={current ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                    transition={current ? { repeat: Infinity, duration: 2 } : {}}
                  />
                  <p className={`display text-[clamp(1.8rem,3vw,2.6rem)] leading-tight ${done ? "" : "text-ink/30"}`}>{t(`status.${s}`)}</p>
                  {s === "shipped" && order.tracking_no && (
                    <p className="mt-1 text-sm text-ink-soft">
                      {t("track")}: {order.courier_name} · <span className="lnum">{order.tracking_no}</span>
                    </p>
                  )}
                  {s !== "completed" && current && order.slot_label && (
                    <p className="lnum mt-1 text-sm text-ink-soft">
                      {order.slot_date} · {order.slot_label}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <aside className="space-y-4 lg:col-span-4 lg:col-start-9">
        {!cancelled && order.status !== "completed" && <PushPrompt />}
        <div className="rounded-[6px] bg-[#fbf6ec] p-6 shadow-[0_24px_50px_-28px_rgba(42,26,18,.5)]">
          <p className="smallcaps text-ink-mute">{order.short_code}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex gap-2">
                <span className="flex-1">
                  {locale === "ta" && i.name_ta ? i.name_ta : i.name_en}
                  <span className="text-ink-mute">
                    {i.grams ? ` · ${formatWeight(i.grams)}` : ""} × {i.qty}
                  </span>
                </span>
                <span className="price">{formatINR(i.line_total)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-dashed border-ink/25 pt-3 text-sm text-ink-soft">
            {order.packing > 0 && (
              <div className="flex justify-between">
                <dt>Packing</dt>
                <dd className="price">{formatINR(order.packing)}</dd>
              </div>
            )}
            {order.delivery_fee > 0 && (
              <div className="flex justify-between">
                <dt>Delivery{order.distance_km ? ` · ${order.distance_km} km` : ""}</dt>
                <dd className="price">{formatINR(order.delivery_fee)}</dd>
              </div>
            )}
          </dl>
          <div className="mt-3 flex items-end justify-between border-t border-ink/60 pt-3">
            <span className="smallcaps">Total</span>
            <span className="display price text-3xl">{formatINR(order.total)}</span>
          </div>
          <p className="mt-3 text-xs text-ink-mute">
            {order.payment_mode.replace(/_/g, " ")} · {order.payment_status}
          </p>
        </div>
        {whatsappUrl(settings.whatsapp_number ?? settings.shop_phone) && (
          <a
            href={whatsappUrl(settings.whatsapp_number ?? settings.shop_phone, tw("waOrder", { code: order.short_code }))!}
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

/** Shown on an active order when this device hasn't turned notifications on yet. */
export function PushPrompt() {
  const t = useTranslations("push");
  const [state, setState] = useState<PushState | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    pushState().then(setState);
  }, []);
  if (hidden || state !== "off") return null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-ink p-5 text-paper">
      <div className="flex items-start gap-3">
        <motion.span animate={{ rotate: [0, -18, 14, -8, 0] }} transition={{ duration: 1, repeat: Infinity, repeatDelay: 3 }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-turmeric text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </motion.span>
        <p className="text-sm">{t("prompt")}</p>
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn btn-turmeric !min-h-10 !py-2 !text-sm" onClick={async () => setState(await enablePush().catch(() => "off" as const))}>
          {t("enable")}
        </button>
        <button className="btn btn-ghost !min-h-10 !py-2 !text-sm !text-paper !shadow-[inset_0_0_0_1px_rgba(255,255,255,.35)]" onClick={() => setHidden(true)}>
          {t("later")}
        </button>
      </div>
    </motion.div>
  );
}
