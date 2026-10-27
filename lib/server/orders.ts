import "server-only";
import Razorpay from "razorpay";
import { supabaseService } from "@/lib/supabase/server";
import type { Order, OrderItem } from "@/lib/types";
import { notifyOrder, notifyStaffNewOrder } from "./notify";

const n = (v: unknown) => (v === null ? null : Number(v));

export function normaliseOrder(o: Record<string, unknown>): Order {
  return {
    ...(o as unknown as Order),
    distance_km: n(o.distance_km),
    delivery_fee: Number(o.delivery_fee),
    subtotal: Number(o.subtotal),
    packing: Number(o.packing),
    total: Number(o.total),
  };
}

export async function loadOrder(id: string) {
  const sb = supabaseService();
  const [{ data: order }, { data: items }] = await Promise.all([
    sb.from("orders").select("*").eq("id", id).single(),
    sb.from("order_items").select("*").eq("order_id", id),
  ]);
  if (!order) return null;
  return {
    order: normaliseOrder(order),
    items: (items ?? []).map((i) => ({ ...i, unit_price: Number(i.unit_price), line_total: Number(i.line_total) })) as OrderItem[],
  };
}

export async function notifyById(id: string, opts: { newOrder?: boolean } = {}) {
  const loaded = await loadOrder(id);
  if (!loaded) return;
  await Promise.all([notifyOrder(loaded.order, loaded.items), opts.newOrder && loaded.order.status === "confirmed" ? notifyStaffNewOrder(loaded.order) : null]);
}

/** Turns a Postgres exception from place_order() into a code the UI can translate. */
export function orderError(message: string): { code: string; item?: string } {
  const m = message.match(/^(OUT_OF_STOCK|ORDERS_CLOSED|SLOT_FULL|SLOT_INVALID|SLOT_REQUIRED|ITEM_UNAVAILABLE|BAD_WEIGHT|EMPTY_ORDER|COURIER_PREPAID_ONLY|BAD_PAYMENT_MODE)(?::(.*))?/);
  return m ? { code: m[1], item: m[2] } : { code: "generic" };
}

/**
 * Opens a Razorpay order for an order placed with upi_online. Without keys the order is
 * cancelled (its stock goes back) so nothing sits in "awaiting payment" forever.
 */
export async function startOnlinePayment(order: { id: string; short_code: string; total: number | string }, who: { name: string; phone: string; email: string }) {
  const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  const sb = supabaseService();
  if (!key_id || !key_secret) {
    await sb.rpc("cancel_order", { p_order: order.id, p_note: "Online payment not configured" });
    return { status: 503, body: { error: "PAYMENTS_NOT_CONFIGURED" } };
  }
  const rp = await new Razorpay({ key_id, key_secret }).orders.create({
    amount: Math.round(Number(order.total) * 100),
    currency: "INR",
    receipt: order.short_code,
    notes: { order_id: order.id },
  });
  await sb.from("orders").update({ razorpay_order_id: rp.id }).eq("id", order.id);
  return {
    status: 200,
    body: {
      order: { id: order.id, short_code: order.short_code, total: Number(order.total) },
      razorpay: { key: key_id, order_id: rp.id, amount: rp.amount, name: who.name, phone: who.phone ?? "", email: who.email },
    },
  };
}
