"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { PushToggle } from "@/components/account/PushToggle";
import { chime } from "@/lib/chime";
import { telUrl, whatsappUrl } from "@/lib/links";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "./AdminShell";

type Msg = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  topic: "order" | "bulk" | "feedback" | "other";
  order_code: string | null;
  message: string;
  status: "new" | "replied" | "closed";
  created_at: string;
};

const TOPIC: Record<Msg["topic"], [string, string]> = {
  order: ["Order help", "bg-turmeric/30"],
  bulk: ["Bulk / party", "bg-leaf/15 text-leaf"],
  feedback: ["Feedback", "bg-maroon/10 text-maroon"],
  other: ["Other", "bg-paper-3"],
};

/** Contact-form inbox: live, with one-tap reply by WhatsApp, call or email. */
export function Messages() {
  const sb = supabaseBrowser()!;
  const toast = useToast();
  const [list, setList] = useState<Msg[] | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");

  useEffect(() => {
    sb.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200).then(({ data }) => setList((data ?? []) as Msg[]));
    const ch = sb
      .channel("admin-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contact_messages" }, ({ new: m }) => {
        setList((l) => [m as Msg, ...(l ?? [])]);
        chime();
        toast(`New message from ${(m as Msg).name}`, "new");
      })
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [sb, toast]);

  const setStatus = async (m: Msg, status: Msg["status"]) => {
    const { error } = await sb.from("contact_messages").update({ status }).eq("id", m.id);
    if (error) return toast(error.message, "err");
    setList((l) => l!.map((x) => (x.id === m.id ? { ...x, status } : x)));
  };

  const shown = (list ?? []).filter((m) => filter === "all" || m.status !== "closed");

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-5xl">Messages</h1>
          <p className="text-sm text-ink-soft">From the contact form. New ones chime here and on phones with notifications on.</p>
        </div>
        <div className="flex items-center gap-2">
          <PushToggle compact />
          {(["open", "all"] as const).map((f) => (
            <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "open" ? "Open" : "All"}
            </button>
          ))}
        </div>
      </div>
      {list === null ? (
        <div className="skeleton h-64" />
      ) : shown.length === 0 ? (
        <p className="display-italic text-2xl text-ink-soft">No messages.</p>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {shown.map((m) => (
              <motion.li key={m.id} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`rounded-[20px] p-5 ${m.status === "new" ? "bg-paper shadow-[inset_0_0_0_1.5px_var(--ink)]" : "bg-paper-2/60"}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{m.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${TOPIC[m.topic][1]}`}>{TOPIC[m.topic][0]}</span>
                  {m.order_code && <span className="lnum text-xs text-ink-soft">{m.order_code}</span>}
                  {m.status === "new" && <span className="dot-live" />}
                  <span className="ml-auto text-xs text-ink-mute">{new Date(m.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-[0.95rem]">{m.message}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  {m.phone && (
                    <>
                      <a className="chip !min-h-9 !text-xs text-[#128C7E]" href={whatsappUrl(m.phone, `Hello ${m.name}, this is Iyer Mess replying to your message. `)!} target="_blank" rel="noopener noreferrer" onClick={() => setStatus(m, "replied")}>
                        WhatsApp {m.phone}
                      </a>
                      <a className="chip !min-h-9 !text-xs" href={telUrl(m.phone)} onClick={() => setStatus(m, "replied")}>
                        Call
                      </a>
                    </>
                  )}
                  {m.email && (
                    <a className="chip !min-h-9 !text-xs" href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to Iyer Mess")}`} onClick={() => setStatus(m, "replied")}>
                      Email
                    </a>
                  )}
                  <span className="ml-auto flex gap-2">
                    {m.status !== "closed" ? (
                      <button className="chip !min-h-9 !text-xs" onClick={() => setStatus(m, "closed")}>Mark done</button>
                    ) : (
                      <button className="chip !min-h-9 !text-xs" onClick={() => setStatus(m, "new")}>Reopen</button>
                    )}
                  </span>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
