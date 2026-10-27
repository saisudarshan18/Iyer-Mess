import "server-only";
import { z } from "zod";
import { getPublicStorefront } from "@/lib/data";
import { sendEmail, shopForEmail } from "@/lib/email/send";
import { courierQuoteEmail } from "@/lib/email/templates";
import type { OrderItems } from "@/lib/order-input";
import { cartTotals, comboWeight, formatINR, round2 } from "@/lib/pricing";
import { supabaseService } from "@/lib/supabase/server";
import type { CourierRequest } from "@/lib/types";
import { pushToStaff, pushToUser } from "./push";
import { sendTemplate, shopWhatsApp, whatsappConfigured } from "./whatsapp";

export function normaliseCourierRequest(r: Record<string, unknown>): CourierRequest {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    ...(r as unknown as CourierRequest),
    distance_km: n(r.distance_km),
    subtotal: Number(r.subtotal),
    packing: Number(r.packing),
    courier_fee: n(r.courier_fee),
  };
}

/**
 * Prices and weighs a cart from the live catalogue. Returns null when a line is
 * unknown, inactive or in a size the shop doesn't sell; place_order() checks again at payment.
 */
export async function priceCart(items: z.infer<typeof OrderItems>) {
  const { products, combos } = await getPublicStorefront();
  let weight = 0;
  for (const it of items) {
    if (it.type === "product") {
      const p = products.find((x) => x.id === it.id);
      if (!p || !p.sell_sizes.includes(it.grams)) return null;
      weight += it.grams * it.qty;
    } else {
      const c = combos.find((x) => x.id === it.id);
      if (!c) return null;
      weight += comboWeight(c) * it.qty;
    }
  }
  const totals = cartTotals(items.map((it, i) => ({ key: String(i), ...it })), products, combos);
  return { subtotal: totals.subtotal, packing: totals.packing, weight_g: weight };
}

export const quoteTotal = (r: Pick<CourierRequest, "subtotal" | "packing" | "courier_fee">) => round2(r.subtotal + r.packing + (r.courier_fee ?? 0));

/** The shop is told a new request is waiting to be weighed and priced. */
export async function notifyStaffCourierRequest(r: CourierRequest) {
  const shop = shopWhatsApp();
  if (shop) {
    sendTemplate({
      to: shop,
      name: "shop_new_order",
      body: [r.short_code, `${formatINR(r.subtotal + r.packing)} + courier`, `${r.customer_name} (+${r.customer_phone})`, "courier quote needed"],
    }).catch((e) => console.error("shop whatsapp failed", e));
  }
  await pushToStaff({
    title: `Courier quote needed · ${r.short_code}`,
    body: `${r.customer_name} · ${(r.weight_g / 1000).toFixed(2)} kg · ${r.distance_km ?? "?"} km`,
    url: "/admin",
    tag: `staff-${r.id}`,
    kind: "staff",
  }).catch((e) => console.error("staff push failed", e));
}

/** The customer hears that the courier charge is ready (or that the shop can't ship it). */
export async function notifyCustomerQuote(r: CourierRequest) {
  const quoted = r.status === "quoted";
  const line = quoted
    ? `Courier charge ${formatINR(r.courier_fee ?? 0)}. Total ${formatINR(quoteTotal(r))}. Approve and pay to place the order.`
    : `Sorry, we can't send this one by courier.${r.shop_note ? ` ${r.shop_note}` : ""}`;
  const tasks: Promise<unknown>[] = [
    pushToUser(r.user_id, { title: `${r.short_code} · ${quoted ? "Courier charge ready" : "Courier not possible"}`, body: line, url: `/orders/${r.id}`, tag: `quote-${r.id}`, kind: "order" }),
  ];
  if (r.customer_email && process.env.RESEND_API_KEY) tasks.push(shopForEmail().then((shop) => sendEmail(r.customer_email!, courierQuoteEmail(shop, r))));
  if (whatsappConfigured()) {
    tasks.push(
      (async () => {
        const { data } = await supabaseService().from("profiles").select("whatsapp_updates").eq("id", r.user_id).single();
        if (data?.whatsapp_updates === false) return;
        await sendTemplate({ to: r.customer_phone, name: "order_update", body: [r.customer_name.split(" ")[0] || "there", r.short_code, quoted ? "courier charge ready" : "not possible by courier", line], urlSuffix: r.id });
      })(),
    );
  }
  for (const res of await Promise.allSettled(tasks)) if (res.status === "rejected") console.error("quote notify failed:", res.reason);
}
