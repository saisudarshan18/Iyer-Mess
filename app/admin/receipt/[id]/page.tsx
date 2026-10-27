import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { normaliseOrder } from "@/lib/server/orders";
import { normaliseSettings } from "@/lib/data";
import { formatINR, formatWeight } from "@/lib/pricing";
import { ReceiptControls } from "@/components/admin/ReceiptControls";

export const metadata = { title: "Receipt" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string; w?: string }> };

/** Thermal receipt (58 / 80 mm). Monospace so columns line up on any printer. */
export default async function ReceiptPage({ params, searchParams }: Props) {
  const [{ id }, { auto, w }] = await Promise.all([params, searchParams]);
  const { sb } = await getSessionProfile();
  const [{ data: o }, { data: items }, { data: s }] = await Promise.all([
    sb.from("orders").select("*").eq("id", id).maybeSingle(),
    sb.from("order_items").select("*").eq("order_id", id),
    sb.from("settings").select("*").eq("id", 1).single(),
  ]);
  if (!o) notFound();
  const order = normaliseOrder(o);
  const settings = normaliseSettings(s!);
  const width = w === "58" ? 58 : 80;

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-paper-2 py-8 print:block print:bg-white print:p-0">
      <style>{`@page { size: ${width}mm auto; margin: 0; } @media print { header, nav { display: none !important } main { padding: 0 !important } }`}</style>
      <ReceiptControls width={width} auto={auto === "1"} />
      <article
        className="bg-white px-[4mm] py-[5mm] font-mono text-[11px] leading-[1.45] text-black shadow-lg print:shadow-none"
        style={{ width: `${width}mm` }}
      >
        <header className="text-center">
          <p className="text-[16px] font-bold">{settings.shop_name.toUpperCase()}</p>
          {settings.shop_address && <p className="whitespace-pre-line">{settings.shop_address}</p>}
          {settings.shop_phone && <p>Ph: {settings.shop_phone}</p>}
        </header>
        <hr className="my-2 border-dashed border-black" />
        <div className="flex justify-between">
          <span>{order.short_code}</span>
          <span>{new Date(order.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <p>
          {order.channel === "walkin" ? "Walk-in" : order.fulfilment.replace(/_/g, " ")}
          {order.customer_name ? ` · ${order.customer_name}` : ""}
        </p>
        {order.slot_label && <p>Slot: {order.slot_date} {order.slot_label}</p>}
        {order.address?.line && <p className="break-words">To: {order.address.line}{order.address.landmark ? `, ${order.address.landmark}` : ""}</p>}
        <hr className="my-2 border-dashed border-black" />
        <table className="w-full">
          <tbody>
            {(items ?? []).map((i) => (
              <tr key={i.id} className="align-top">
                <td className="pr-1">
                  {i.name_en}
                  <br />
                  <span>
                    {i.grams ? formatWeight(i.grams) + " " : ""}x{i.qty}
                  </span>
                </td>
                <td className="whitespace-nowrap text-right">{formatINR(Number(i.line_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className="my-2 border-dashed border-black" />
        {order.packing > 0 && <Line k="Packing" v={formatINR(order.packing)} />}
        {order.delivery_fee > 0 && <Line k="Delivery" v={formatINR(order.delivery_fee)} />}
        <div className="flex justify-between text-[14px] font-bold">
          <span>TOTAL</span>
          <span>{formatINR(order.total)}</span>
        </div>
        <Line k="Paid by" v={`${order.payment_mode.replace(/_/g, " ")} (${order.payment_status})`} />
        <hr className="my-2 border-dashed border-black" />
        <p className="text-center">Thank you! மீண்டும் வருக</p>
      </article>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
