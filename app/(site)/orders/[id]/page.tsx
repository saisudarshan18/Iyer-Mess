import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CourierQuote } from "@/components/account/CourierQuote";
import { OrderStatus } from "@/components/account/OrderStatus";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSessionProfile } from "@/lib/supabase/server";
import { normaliseOrder } from "@/lib/server/orders";
import { normaliseCourierRequest } from "@/lib/server/courier";
import type { OrderItem } from "@/lib/types";

export const metadata: Metadata = { title: "Order" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string; requested?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  if (!isSupabaseConfigured()) redirect("/login");
  const [{ id }, { placed, requested }] = await Promise.all([params, searchParams]);
  const { sb, user } = await getSessionProfile();
  if (!user) redirect(`/login?next=/orders/${id}`);
  // RLS limits these to the customer's own orders and courier quotes (or staff)
  const [{ data: order }, { data: items }] = await Promise.all([
    sb.from("orders").select("*").eq("id", id).maybeSingle(),
    sb.from("order_items").select("*").eq("order_id", id),
  ]);
  // courier deliveries start as a quote request and share this address, so one link works throughout
  const quote = order ? null : (await sb.from("courier_requests").select("*").eq("id", id).maybeSingle()).data;
  if (!order && !quote) notFound();
  return (
    <section className="px-[var(--gutter)] pb-28 pt-32 md:pt-40">
      <Link href="/orders" className="ink-link text-sm text-ink-soft">
        ← My orders
      </Link>
      <h1 className="display mb-14 mt-6 text-[clamp(3rem,8vw,7rem)]">{order?.short_code ?? quote.short_code}</h1>
      {order ? (
        <OrderStatus
          initial={normaliseOrder(order)}
          items={(items ?? []).map((i) => ({ ...i, unit_price: Number(i.unit_price), line_total: Number(i.line_total) })) as OrderItem[]}
          placed={placed === "1"}
        />
      ) : (
        <CourierQuote initial={normaliseCourierRequest(quote)} requested={requested === "1"} nonce={(await headers()).get("x-nonce") ?? undefined} />
      )}
    </section>
  );
}
