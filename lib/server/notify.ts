import "server-only";
import { sendEmail, shopForEmail } from "@/lib/email/send";
import { orderEmail } from "@/lib/email/templates";
import { formatINR } from "@/lib/pricing";
import type { Order, OrderItem } from "@/lib/types";
import { supabaseService } from "@/lib/supabase/server";
import { pushToStaff, pushToUser } from "./push";
import { sendTemplate, shopWhatsApp, whatsappConfigured } from "./whatsapp";

const STATUS_EN: Record<string, string> = {
  pending_payment: "awaiting payment",
  confirmed: "confirmed",
  preparing: "being prepared",
  ready: "ready for pickup",
  out_for_delivery: "out for delivery",
  shipped: "shipped",
  completed: "completed",
  cancelled: "cancelled",
};

/** Order email to the customer (and a copy to the shop), in the branded template. */
async function sendOrderEmail(order: Order, items: OrderItem[]) {
  const to = [order.customer_email, process.env.SHOP_NOTIFY_EMAIL].filter(Boolean) as string[];
  if (!to.length || !process.env.RESEND_API_KEY) return;
  await sendEmail(to, orderEmail(await shopForEmail(), order, items));
}

const PUSH_BODY: Record<string, string> = {
  pending_payment: "Waiting for your UPI payment.",
  confirmed: "We've got your order and will start on it soon.",
  preparing: "Your sweets are being packed now.",
  ready: "Your order is ready. Come pick it up!",
  out_for_delivery: "Your order is on its way.",
  shipped: "Your order has been handed to the courier.",
  completed: "Delivered. Thank you, and enjoy!",
  cancelled: "Your order was cancelled.",
};

function pushOrder(order: Order) {
  if (!order.user_id) return Promise.resolve();
  return pushToUser(order.user_id, {
    title: `${order.short_code} · ${STATUS_EN[order.status][0].toUpperCase()}${STATUS_EN[order.status].slice(1)}`,
    body: order.status === "shipped" && order.tracking_no ? `${PUSH_BODY.shipped} Tracking: ${order.tracking_no}` : PUSH_BODY[order.status],
    url: `/orders/${order.id}`,
    tag: `order-${order.id}`,
    kind: "order",
  });
}

/** WhatsApp template `order_update` to the customer, unless they switched it off on /account. */
async function whatsappOrder(order: Order) {
  // "awaiting payment" is shown on the checkout screen itself; no need to spend a message on it
  if (!whatsappConfigured() || !order.customer_phone || order.channel !== "online" || order.status === "pending_payment") return;
  if (order.user_id) {
    const { data } = await supabaseService().from("profiles").select("whatsapp_updates").eq("id", order.user_id).single();
    if (data && data.whatsapp_updates === false) return;
  }
  const detail = order.status === "shipped" && order.tracking_no ? `${PUSH_BODY.shipped} Tracking: ${order.tracking_no}` : PUSH_BODY[order.status];
  await sendTemplate({
    to: order.customer_phone,
    name: "order_update",
    body: [order.customer_name?.split(" ")[0] || "there", order.short_code, STATUS_EN[order.status], detail],
    urlSuffix: order.id,
  });
}

/** Fire-and-forget: a failed email, push or WhatsApp must never fail the order itself. */
export async function notifyOrder(order: Order, items: OrderItem[]) {
  const results = await Promise.allSettled([sendOrderEmail(order, items), pushOrder(order), whatsappOrder(order)]);
  for (const r of results) if (r.status === "rejected") console.error("notify failed:", r.reason);
}

/** Staff devices chime for every new confirmed online order, and the shop's WhatsApp gets a note. */
export async function notifyStaffNewOrder(order: Order) {
  if (order.channel !== "online") return;
  const shop = shopWhatsApp();
  if (shop) {
    sendTemplate({
      to: shop,
      name: "shop_new_order",
      body: [order.short_code, formatINR(order.total), `${order.customer_name ?? "Customer"} ${order.customer_phone ? `(+${order.customer_phone})` : ""}`, order.fulfilment.replace(/_/g, " ")],
    }).catch((e) => console.error("shop whatsapp failed", e));
  }
  await pushToStaff({
    title: `New order ${order.short_code}`,
    body: `${formatINR(order.total)} · ${order.customer_name ?? "Customer"} · ${order.fulfilment.replace(/_/g, " ")}`,
    url: "/admin",
    tag: `staff-${order.id}`,
    kind: "staff",
  }).catch((e) => console.error("staff push failed", e));
}
