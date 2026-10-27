import { formatINR, formatWeight } from "@/lib/pricing";
import type { CourierRequest, Order, OrderItem } from "@/lib/types";
import { C, SERIF, button, codeBlock, divider, esc, layout, type Shop } from "./layout";

export type Email = { subject: string; html: string; text: string };

const p = (html: string, style = "") => `<p style="margin:14px 0 0;color:${C.soft};${style}">${html}</p>`;
const small = (html: string) => `<p style="margin:0;font-size:13px;line-height:1.6;color:${C.mute}">${html}</p>`;

export type CodeKind = "login" | "signup" | "email_change" | "reauth";

/** Login / sign-up / email-change codes sent by the Supabase "Send Email" hook. */
export function codeEmail(shop: Shop, code: string, kind: CodeKind, toEmail: string): Email {
  const copy = {
    login: { kicker: "Login code", subject: `${code} is your Iyer Mess login code`, title: "Here's your code", lead: "Enter it on the Iyer Mess website to log in. No password needed." },
    signup: { kicker: "Welcome", subject: `${code} is your Iyer Mess code`, title: "Vanakkam, welcome!", lead: "Enter this code to finish creating your account. Next, we'll ask for your mobile number so our delivery team can reach you." },
    email_change: { kicker: "Account", subject: `${code} confirms your new email`, title: "Confirm your new email", lead: `Enter this code to start using <b style="color:${C.ink}">${esc(toEmail)}</b> for Iyer Mess.` },
    reauth: { kicker: "Security check", subject: `${code} is your Iyer Mess security code`, title: "Confirm it's you", lead: "Enter this code to continue." },
  }[kind];
  const html = layout({
    shop,
    preheader: `${code} · expires in 10 minutes`,
    kicker: copy.kicker,
    title: copy.title,
    body: `${p(copy.lead)}${codeBlock(code)}
<p style="margin:10px 0 0;text-align:center;font-size:14px;color:${C.soft}">Expires in <b style="color:${C.ink}">10 minutes</b> · works once</p>
${divider(shop.site)}
${small(`Didn't ask for this? You can ignore this email; nobody can log in without the code. <b style="color:${C.soft}">Iyer Mess will never ask you for this code</b> by phone, WhatsApp or email.`)}`,
  });
  const text = `${copy.title}\n\n${copy.lead.replace(/<[^>]+>/g, "")}\n\nYour code: ${code}\nIt expires in 10 minutes.\n\nDidn't ask for this? Ignore this email. Iyer Mess will never ask you for this code.\n\n${shop.site}`;
  return { subject: copy.subject, html, text };
}

/** Code required before changing the mobile number on an account. */
export function phoneChangeEmail(shop: Shop, code: string, newPhone: string): Email {
  const pretty = `+91 ${newPhone.slice(-10, -5)} ${newPhone.slice(-5)}`;
  const html = layout({
    shop,
    preheader: `${code} · confirm your new mobile number`,
    kicker: "Account security",
    title: "Confirm your new number",
    body: `${p(`Someone (hopefully you) asked to change the mobile number on your Iyer Mess account to <b style="color:${C.ink}">${esc(pretty)}</b>. Enter this code to confirm:`)}
${codeBlock(code)}
<p style="margin:10px 0 0;text-align:center;font-size:14px;color:${C.soft}">Expires in <b style="color:${C.ink}">10 minutes</b></p>
${divider(shop.site)}
${small(`If this wasn't you, don't share the code. Your number stays the same, and you may want to <a href="${shop.site}/contact" style="color:${C.maroon}">let us know</a>.`)}`,
  });
  const text = `Confirm your new mobile number\n\nChange to ${pretty}? Your code: ${code} (expires in 10 minutes).\nIf this wasn't you, ignore this email; nothing changes.\n\n${shop.site}`;
  return { subject: `${code} confirms your new mobile number`, html, text };
}

const STATUS: Record<string, { label: string; line: string }> = {
  pending_payment: { label: "Awaiting payment", line: "We're waiting for your UPI payment to come through." },
  confirmed: { label: "Confirmed", line: "We've got your order and will start on it soon." },
  preparing: { label: "Being prepared", line: "Your sweets and savories are being packed now." },
  ready: { label: "Ready for pickup", line: "Your order is ready. Come and collect it at your slot." },
  out_for_delivery: { label: "Out for delivery", line: "Your order is on its way to you." },
  shipped: { label: "Shipped", line: "Your order has been handed to the courier." },
  completed: { label: "Completed", line: "Delivered. Thank you, and enjoy every bite!" },
  cancelled: { label: "Cancelled", line: "Your order was cancelled. If you paid online, the refund follows our cancellation policy." },
};

const PAY: Record<string, string> = {
  cash: "Cash on delivery / pickup",
  upi_on_delivery: "UPI on delivery / pickup",
  upi_online: "UPI, paid online",
  upi_counter: "UPI at the counter",
};

function steps(order: Order) {
  const path: Record<Order["fulfilment"], string[]> = {
    delivery_local: ["confirmed", "preparing", "out_for_delivery", "completed"],
    courier: ["confirmed", "preparing", "shipped", "completed"],
    takeaway: ["confirmed", "preparing", "ready", "completed"],
    counter: ["completed"],
  };
  const list = path[order.fulfilment];
  const at = list.indexOf(order.status);
  if (order.status === "cancelled" || at < 0) return "";
  const cells = list
    .map((s, i) => {
      const done = i <= at;
      return `<td align="center" valign="top" style="width:${100 / list.length}%;padding:0 2px">
<div style="height:6px;border-radius:999px;background:${done ? (i === at ? C.turmeric : C.leaf) : C.rule}"></div>
<div style="margin-top:8px;font-size:12px;line-height:1.3;color:${done ? C.ink : C.mute};${i === at ? "font-weight:700" : ""}">${esc(STATUS[s].label)}</div></td>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px"><tr>${cells}</tr></table>`;
}

/** Order placed / status changed. */
export function orderEmail(shop: Shop, order: Order, items: OrderItem[]): Email {
  const st = STATUS[order.status] ?? STATUS.confirmed;
  const row = (left: string, right: string, strong = false) =>
    `<tr><td style="padding:7px 0;color:${strong ? C.ink : C.soft};${strong ? "font-weight:700;font-size:17px" : ""}">${left}</td><td align="right" style="padding:7px 0;white-space:nowrap;color:${C.ink};${strong ? "font-weight:700;font-size:17px" : ""}">${right}</td></tr>`;
  const itemRows = items
    .map((i) => row(`${esc(i.name_en)}${i.grams ? ` <span style="color:${C.mute}">· ${formatWeight(i.grams)}</span>` : ""} <span style="color:${C.mute}">× ${i.qty}</span>`, formatINR(i.line_total)))
    .join("");
  const slot = order.slot_label ? `<br><span style="color:${C.mute}">Slot:</span> ${esc(order.slot_date ?? "")} · ${esc(order.slot_label)}` : "";
  const track = order.tracking_no ? `<br><span style="color:${C.mute}">Courier:</span> ${esc(order.courier_name ?? "")} · <b>${esc(order.tracking_no)}</b>` : "";
  const html = layout({
    shop,
    preheader: `${order.short_code}: ${st.label}. ${st.line}`,
    kicker: `Order ${order.short_code}`,
    title: `${st.label}`,
    body: `${p(st.line)}
${steps(order)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;border-top:1px solid ${C.rule};font-family:${SERIF};font-size:15px">
${itemRows}
${order.packing ? row("Packing", formatINR(order.packing)) : ""}
${order.delivery_fee ? row(`Delivery${order.distance_km ? ` · ${order.distance_km} km` : ""}`, formatINR(order.delivery_fee)) : ""}
<tr><td colspan="2" style="border-top:1px solid ${C.ink};height:1px;font-size:0;line-height:0">&nbsp;</td></tr>
${row("Total", formatINR(order.total), true)}
</table>
<p style="margin:14px 0 0;font-size:14px;color:${C.soft}"><span style="color:${C.mute}">Payment:</span> ${esc(PAY[order.payment_mode] ?? order.payment_mode)}${order.payment_status === "paid" ? ` · <span style="color:${C.leaf}">paid</span>` : ""}${slot}${track}</p>
${button(`${shop.site}/orders/${order.id}`, "View your order")}
${divider(shop.site)}
${small(`Questions? Reply on WhatsApp or call us, and mention order <b>${esc(order.short_code)}</b>.`)}`,
  });
  const text = `Order ${order.short_code}: ${st.label}\n${st.line}\n\n${items.map((i) => `${i.name_en}${i.grams ? ` ${formatWeight(i.grams)}` : ""} x${i.qty}  ${formatINR(i.line_total)}`).join("\n")}\nTotal ${formatINR(order.total)}\n\nView: ${shop.site}/orders/${order.id}`;
  return { subject: `Iyer Mess · ${order.short_code} ${st.label.toLowerCase()}`, html, text };
}

/** The shop has priced (or turned down) a courier delivery. */
export function courierQuoteEmail(shop: Shop, r: CourierRequest): Email {
  const quoted = r.status === "quoted";
  const fee = r.courier_fee ?? 0;
  const total = r.subtotal + r.packing + fee;
  const row = (left: string, right: string, strong = false) =>
    `<tr><td style="padding:7px 0;color:${strong ? C.ink : C.soft};${strong ? "font-weight:700;font-size:17px" : ""}">${left}</td><td align="right" style="padding:7px 0;white-space:nowrap;color:${C.ink};${strong ? "font-weight:700;font-size:17px" : ""}">${right}</td></tr>`;
  const title = quoted ? "Your courier charge is ready" : "We can't send this by courier";
  const lead = quoted
    ? `We've weighed your parcel (about ${(r.weight_g / 1000).toFixed(2)} kg) and checked the courier rate to your address. Approve the total and pay by UPI to place the order.`
    : `Sorry, we're not able to send this order by courier.${r.shop_note ? ` ${esc(r.shop_note)}` : ""} Please call or WhatsApp us and we'll help.`;
  const html = layout({
    shop,
    preheader: quoted ? `${r.short_code}: courier ${formatINR(fee)}, total ${formatINR(total)}` : `${r.short_code}: courier not possible`,
    kicker: `Courier quote ${r.short_code}`,
    title,
    body: `${p(lead)}
${
  quoted
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;border-top:1px solid ${C.rule};font-family:${SERIF};font-size:15px">
${row("Items", formatINR(r.subtotal))}
${r.packing ? row("Packing", formatINR(r.packing)) : ""}
${row(`Courier${r.courier_name ? ` · ${esc(r.courier_name)}` : ""}`, formatINR(fee))}
<tr><td colspan="2" style="border-top:1px solid ${C.ink};height:1px;font-size:0;line-height:0">&nbsp;</td></tr>
${row("Total", formatINR(total), true)}
</table>
${r.shop_note ? p(`<i>${esc(r.shop_note)}</i>`) : ""}
${button(`${shop.site}/orders/${r.id}`, "Approve & pay")}`
    : button(`${shop.site}/contact`, "Contact us")
}
${divider(shop.site)}
${small(`Nothing is charged until you approve and pay. Item prices are confirmed at payment.`)}`,
  });
  const text = quoted
    ? `${title}

Items ${formatINR(r.subtotal)}${r.packing ? `
Packing ${formatINR(r.packing)}` : ""}
Courier ${formatINR(fee)}
Total ${formatINR(total)}

Approve & pay: ${shop.site}/orders/${r.id}`
    : `${title}

${r.shop_note ?? ""}

${shop.site}/contact`;
  return { subject: `Iyer Mess · ${r.short_code} ${quoted ? `courier charge ${formatINR(fee)}` : "courier not possible"}`, html, text };
}

export type ContactMsg = { name: string; phone?: string | null; email?: string | null; topic: string; order_code?: string | null; message: string };

/** A contact-form message, to the shop's inbox. */
export function contactEmail(shop: Shop, m: ContactMsg): Email {
  const meta = [m.phone && `+91 ${esc(m.phone)}`, m.email && esc(m.email), m.order_code && `Order ${esc(m.order_code)}`].filter(Boolean).join(" &nbsp;·&nbsp; ");
  const html = layout({
    shop,
    preheader: `${m.topic} from ${m.name}: ${m.message.slice(0, 90)}`,
    kicker: "Contact form",
    title: `${m.topic} from ${m.name}`,
    body: `<p style="margin:6px 0 0;font-size:14px;color:${C.mute}">${meta}</p>
<div style="margin-top:18px;padding:18px 20px;background:${C.paper};border-left:3px solid ${C.turmeric};border-radius:0 14px 14px 0;white-space:pre-wrap;color:${C.ink}">${esc(m.message)}</div>
${button(`${shop.site}/admin/messages`, "Open in Admin")}
${m.email ? `${divider(shop.site)}${small("Reply to this email to answer the customer directly.")}` : ""}`,
  });
  const text = `${m.topic} from ${m.name}\n${[m.phone, m.email, m.order_code].filter(Boolean).join(" · ")}\n\n${m.message}\n\n${shop.site}/admin/messages`;
  return { subject: `Iyer Mess · ${m.topic} from ${m.name}`, html, text };
}
