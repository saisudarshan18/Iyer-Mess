import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSessionProfile } from "@/lib/supabase/server";
import { normaliseOrder } from "@/lib/server/orders";
import { normaliseCourierRequest, quoteTotal } from "@/lib/server/courier";
import { formatINR } from "@/lib/pricing";

export const metadata: Metadata = { title: "My orders" };

export default async function OrdersPage() {
  if (!isSupabaseConfigured()) redirect("/login");
  const { sb, user } = await getSessionProfile();
  if (!user) redirect("/login?next=/orders");
  const [t, tq] = await Promise.all([getTranslations("orders"), getTranslations("courierQuote")]);
  const [{ data }, { data: open }] = await Promise.all([
    sb.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    // courier quotes still waiting on the shop or on the customer
    sb.from("courier_requests").select("*").eq("user_id", user.id).in("status", ["requested", "quoted"]).order("created_at", { ascending: false }),
  ]);
  const orders = (data ?? []).map(normaliseOrder);
  const quotes = (open ?? []).map(normaliseCourierRequest);

  return (
    <section className="px-[var(--gutter)] pb-28 pt-32 md:pt-40">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h1 className="display text-[clamp(3.5rem,9vw,8rem)]">{t("title")}</h1>
        <form action="/auth/signout" method="post">
          <button className="ink-link text-sm text-ink-soft">Log out</button>
        </form>
      </div>
      {quotes.length > 0 && (
        <div className="mt-12">
          <p className="smallcaps text-ink-mute">{tq("listTitle")}</p>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {quotes.map((q) => (
              <li key={q.id}>
                <Link href={`/orders/${q.id}`} className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl p-5 transition-colors ${q.status === "quoted" ? "bg-turmeric hover:bg-turmeric/85" : "bg-paper-2 hover:bg-paper-3"}`}>
                  <span className="lnum text-sm text-ink-mute">{q.short_code}</span>
                  <span className="display flex-1 text-2xl">{tq(`status.${q.status}`)}</span>
                  <span className="price text-lg">{q.courier_fee === null ? `${formatINR(q.subtotal + q.packing)}+` : formatINR(quoteTotal(q))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {orders.length === 0 ? (
        quotes.length === 0 && <p className="display-italic mt-12 text-3xl text-ink-soft">{t("none")}</p>
      ) : (
        <ul className="mt-12 divide-y divide-rule border-y border-rule">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="group flex flex-wrap items-center gap-x-6 gap-y-1 py-6">
                <span className="lnum w-24 text-sm text-ink-mute">{o.short_code}</span>
                <span className="display flex-1 text-2xl transition-transform duration-500 group-hover:translate-x-2">{t(`status.${o.status}`)}</span>
                <span className="lnum text-sm text-ink-soft">{new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                <span className="price w-24 text-right text-lg">{formatINR(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
