import { describe, expect, it } from "vitest";
import { checkCode, hashCode, makeCode, MAX_CODE_ATTEMPTS, normalisePhone } from "./phone";
import { codeEmail, contactEmail, orderEmail, phoneChangeEmail } from "./email/templates";
import type { Order } from "./types";

describe("phone numbers", () => {
  it("normalises Indian mobiles and rejects everything else", () => {
    for (const v of ["9876543210", "+91 98765 43210", "09876543210", "919876543210"]) expect(normalisePhone(v)).toBe("919876543210");
    for (const v of ["5876543210", "98765", "+1 415 555 0100", "abc", ""]) expect(normalisePhone(v)).toBeNull();
  });
});

describe("change codes", () => {
  const user = "u1", phone = "919876543210", pepper = "pepper";
  const row = (over = {}) => ({ code_hash: hashCode("123456", user, phone, pepper), new_phone: phone, attempts: 0, expires_at: new Date(Date.now() + 60_000).toISOString(), used_at: null, ...over });

  it("makes six-digit codes", () => {
    for (let i = 0; i < 50; i++) expect(makeCode()).toMatch(/^\d{6}$/);
  });
  it("accepts the right code for the right number only", () => {
    expect(checkCode(row(), "123456", user, phone, pepper).ok).toBe(true);
    expect(checkCode(row(), "654321", user, phone, pepper)).toMatchObject({ ok: false, reason: "BAD_CODE", left: MAX_CODE_ATTEMPTS - 1 });
    expect(checkCode(row(), "123456", user, "919999999999", pepper)).toMatchObject({ reason: "NO_CODE" });
    expect(checkCode(row(), "123456", "someone-else", phone, pepper)).toMatchObject({ reason: "BAD_CODE" });
  });
  it("expires, locks after 5 tries, and can't be reused", () => {
    expect(checkCode(row({ expires_at: new Date(Date.now() - 1).toISOString() }), "123456", user, phone, pepper)).toMatchObject({ reason: "EXPIRED" });
    expect(checkCode(row({ attempts: MAX_CODE_ATTEMPTS }), "123456", user, phone, pepper)).toMatchObject({ reason: "LOCKED" });
    expect(checkCode(row({ used_at: new Date().toISOString() }), "123456", user, phone, pepper)).toMatchObject({ reason: "NO_CODE" });
  });
});

describe("email templates escape everything customers type", () => {
  const shop = { name: "Iyer Mess", address: "No. 1 <b>St</b>", phone: "9952390089", whatsapp: "9952390089", site: "https://iyermess.svcloudkitchen.com" };
  const evil = `<script>alert(1)</script>`;
  it("never contains raw markup from input", () => {
    const order = { id: "o1", short_code: "IM1001", fulfilment: "delivery_local", status: "out_for_delivery", payment_mode: "cash", payment_status: "unpaid", packing: 20, delivery_fee: 100, distance_km: 3, total: 770, slot_label: evil, slot_date: "2026-10-22", tracking_no: null, courier_name: null } as unknown as Order;
    const outs = [
      codeEmail(shop, "123456", "email_change", `${evil}@x.in`),
      phoneChangeEmail(shop, "123456", "919876543210"),
      orderEmail(shop, order, [{ id: "i", order_id: "o1", product_id: null, combo_id: null, name_en: evil, name_ta: null, grams: 500, qty: 1, unit_price: 300, line_total: 300 }]),
      contactEmail(shop, { name: evil, phone: "9876543210", email: "a@b.in", topic: "Feedback", message: evil }),
    ];
    for (const e of outs) {
      expect(e.html).not.toContain("<script>");
      expect(e.html).not.toContain("<b>St</b>");
      expect(e.text.length).toBeGreaterThan(20);
    }
    expect(outs[0].html).toContain("123456");
    expect(outs[2].html).toContain("Out for delivery");
  });
});
