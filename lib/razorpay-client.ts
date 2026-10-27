"use client";

type RazorpayHandlerResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: () => void) => void };
  }
}

export type PaymentStart = {
  order: { id: string; short_code: string; total: number };
  razorpay: { key: string; order_id: string; amount: number; name: string; phone: string; email: string };
};

/** Opens UPI checkout for an order the server just placed. Returns false if the script hasn't loaded. */
export function openRazorpay(json: PaymentStart, shopName: string, on: { paid: () => void; dismissed: () => void }) {
  if (!window.Razorpay) return false;
  const rz = new window.Razorpay({
    key: json.razorpay.key,
    order_id: json.razorpay.order_id,
    amount: json.razorpay.amount,
    currency: "INR",
    name: shopName,
    description: json.order.short_code,
    prefill: { name: json.razorpay.name, contact: json.razorpay.phone, email: json.razorpay.email },
    method: { upi: true, card: false, netbanking: false, wallet: false, emi: false, paylater: false },
    theme: { color: "#7a1f1f" },
    handler: async (r: RazorpayHandlerResponse) => {
      await fetch("/api/razorpay/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: json.order.id, ...r }) });
      on.paid();
    },
    // stock stays held until the hold expires; the order page shows it
    modal: { ondismiss: on.dismissed },
  });
  rz.open();
  return true;
}
