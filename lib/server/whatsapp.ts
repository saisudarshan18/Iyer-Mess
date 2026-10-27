import "server-only";
import { normalisePhone } from "@/lib/validate";

const GRAPH = "https://graph.facebook.com/v21.0";

export const whatsappConfigured = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

// Meta rejects template parameters with newlines, tabs or long runs of spaces
const clean = (v: string) => v.replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, 900) || "-";

export type TemplateSend = {
  /** Any Indian mobile format; normalised to 91XXXXXXXXXX. */
  to: string;
  /** Approved template name in WhatsApp Manager. */
  name: string;
  lang?: string;
  body: string[];
  /** Dynamic suffix for a URL button (button index 0), e.g. an order id. */
  urlSuffix?: string;
};

/** The Cloud API request for one template message (exported for tests). */
export function templateRequest({ to, name, lang = "en", body, urlSuffix }: TemplateSend) {
  const phone = normalisePhone(to);
  if (!phone) return null;
  const components: object[] = [{ type: "body", parameters: body.map((text) => ({ type: "text", text: clean(text) })) }];
  if (urlSuffix) components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: urlSuffix }] });
  return { messaging_product: "whatsapp", recipient_type: "individual", to: phone, type: "template", template: { name, language: { code: lang }, components } };
}

/** Send an approved template. Quietly does nothing until the WhatsApp keys are set. */
export async function sendTemplate(msg: TemplateSend) {
  if (!whatsappConfigured()) return;
  const payload = templateRequest(msg);
  if (!payload) return;
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`WhatsApp ${msg.name} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** The shop's own WhatsApp, for new-order and new-message alerts. */
export const shopWhatsApp = () => process.env.WHATSAPP_SHOP_TO || null;
