"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Logo } from "@/components/art/Logo";
import { PushToggle } from "@/components/account/PushToggle";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Settings } from "@/lib/types";

type Role = "staff" | "owner";
const RoleCtx = createContext<Role>("staff");
export const useRole = () => useContext(RoleCtx);

type Toast = { id: number; text: string; tone: "ok" | "err" | "new" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

const NAV = [
  { href: "/admin", label: "Orders", owner: false, icon: "M4 7h16M4 12h16M4 17h10" },
  { href: "/admin/pos", label: "Walk-in", owner: false, icon: "M4 5h16v10H4zM8 19h8M12 15v4" },
  { href: "/admin/inventory", label: "Inventory", owner: false, icon: "M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" },
  { href: "/admin/messages", label: "Messages", owner: false, icon: "M4 5h16v11H8l-4 4z" },
  { href: "/admin/reports", label: "Reports", owner: true, icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/admin/settings", label: "Settings", owner: true, icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13a7.5 7.5 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.5z" },
];
// what fits in the phone tab bar; the rest goes under "More"
const BAR = 4;

const isActive = (href: string, path: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Unanswered contact messages, kept live so the Messages tab can show a badge. */
function useOpenMessages() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const load = () => {
      sb.from("contact_messages")
        .select("id", { count: "exact", head: true })
        .eq("status", "new")
        .then(({ count }) => setCount(count ?? 0));
    };
    load();
    const ch = sb.channel("admin-shell-messages").on("postgres_changes", { event: "*", schema: "public", table: "contact_messages" }, load).subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, []);
  return count;
}

export function AdminShell({ role, name, settings, children }: { role: Role; name: string; settings: Settings; children: React.ReactNode }) {
  const pathname = usePathname();
  // the tapped tab lights up straight away, before the next page has arrived
  const [tapped, setTapped] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const unread = useOpenMessages();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "new" ? 8000 : 4000);
  }, []);

  useEffect(() => {
    setTapped(null);
    setMore(false);
  }, [pathname]);

  const current = tapped ?? pathname;
  const nav = NAV.filter((n) => !n.owner || role === "owner");
  const bar = nav.slice(0, BAR);
  const rest = nav.slice(BAR);
  const tap = (href: string) => () => {
    if (href !== pathname) setTapped(href);
  };
  const badge = (href: string) =>
    href === "/admin/messages" && unread > 0 ? (
      <span className="lnum absolute -right-3 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-kumkum px-1 text-[11px] font-semibold text-paper">{unread > 9 ? "9+" : unread}</span>
    ) : null;

  return (
    <RoleCtx.Provider value={role}>
      <ToastCtx.Provider value={toast}>
        <div className="min-h-screen bg-paper">
          <header className="no-print sticky top-0 z-30 border-b border-rule bg-paper/90 backdrop-blur">
            <div className="flex items-center gap-x-6 px-4 py-2.5 md:px-8 lg:py-3">
              <Link href="/" className="group flex shrink-0 items-center gap-3">
                <Logo tamil={false} />
                <span className="hidden text-xs uppercase tracking-[0.2em] text-ink-mute sm:inline">Admin</span>
              </Link>
              <nav className="hidden gap-1 lg:flex" aria-label="Admin">
                {nav.map((n) => {
                  const active = isActive(n.href, current);
                  return (
                    <Link key={n.href} href={n.href} prefetch onClick={tap(n.href)} className={`relative shrink-0 rounded-full px-4 py-2 text-sm ${active ? "text-paper" : "hover:bg-paper-2"}`}>
                      {active && <motion.span layoutId="admin-nav" className="absolute inset-0 -z-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                      <span className="relative">
                        {n.label}
                        {badge(n.href)}
                      </span>
                    </Link>
                  );
                })}
              </nav>
              <div className="ml-auto flex items-center gap-4">
                <div className="hidden xl:block" title="Get a notification on this device for every new online order">
                  <PushToggle compact />
                </div>
                <OrdersSwitch initial={settings} />
                <span className="hidden text-sm text-ink-soft xl:inline">{name}</span>
              </div>
            </div>
          </header>
          <main className="px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-6 md:px-8 md:pt-8 lg:pb-8">{children}</main>

          {/* phones and tablets: a tab bar within thumb reach */}
          <nav aria-label="Admin sections" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
            <ul className="mx-auto flex max-w-2xl">
              {bar.map((n) => {
                const active = isActive(n.href, current);
                return (
                  <li key={n.href} className="flex-1">
                    <Link
                      href={n.href}
                      prefetch
                      onClick={tap(n.href)}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] transition-colors md:h-[72px] md:text-xs ${active ? "text-ink" : "text-ink-mute"}`}
                    >
                      {active && <motion.span layoutId="admin-tab" className="absolute inset-x-2 inset-y-1.5 rounded-2xl bg-paper-3" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                      <span className="relative">
                        <Icon d={n.icon} />
                        {badge(n.href)}
                      </span>
                      <span className="relative font-medium">{n.label}</span>
                    </Link>
                  </li>
                );
              })}
              <li className="flex-1">
                <button
                  onClick={() => setMore(true)}
                  aria-expanded={more}
                  className={`relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] md:h-[72px] md:text-xs ${rest.some((n) => isActive(n.href, current)) ? "text-ink" : "text-ink-mute"}`}
                >
                  {rest.some((n) => isActive(n.href, current)) && <span className="absolute inset-x-2 inset-y-1.5 rounded-2xl bg-paper-3" />}
                  <span className="relative">
                    <Icon d="M5 12h.01M12 12h.01M19 12h.01" size={24} />
                  </span>
                  <span className="relative font-medium">More</span>
                </button>
              </li>
            </ul>
          </nav>
          <AnimatePresence>
            {more && <motion.div key="scrim" className="no-print fixed inset-0 z-40 bg-ink/30 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)} />}
            {more && (
              <motion.div
                key="sheet"
                role="dialog"
                aria-label="More"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 420, damping: 40 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, i) => i.offset.y > 80 && setMore(false)}
                className="no-print fixed inset-x-0 bottom-0 z-50 mx-auto max-w-2xl rounded-t-[28px] bg-paper px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_60px_-20px_rgba(42,26,18,.5)] lg:hidden"
              >
                <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-rule" aria-hidden />
                <p className="px-3 text-xs uppercase tracking-[0.2em] text-ink-mute">{name}</p>
                <ul className="mt-2 grid gap-1">
                  {rest.map((n) => (
                    <li key={n.href}>
                      <Link href={n.href} prefetch onClick={tap(n.href)} className={`flex items-center gap-4 rounded-2xl px-3 py-4 text-base ${isActive(n.href, current) ? "bg-paper-3" : "active:bg-paper-2"}`}>
                        <Icon d={n.icon} />
                        {n.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link href="/" className="flex items-center gap-4 rounded-2xl px-3 py-4 text-base active:bg-paper-2">
                      <Icon d="M4 20V10l8-6 8 6v10h-5v-6H9v6z" />
                      Open the shop site
                    </Link>
                  </li>
                </ul>
                <div className="mt-3 border-t border-rule px-3 pt-4">
                  <p className="mb-2 text-sm text-ink-soft">New-order alerts on this device</p>
                  <PushToggle compact />
                </div>
                <form action="/auth/signout" method="post" className="mt-3">
                  <button className="flex w-full items-center gap-4 rounded-2xl px-3 py-4 text-base text-kumkum active:bg-kumkum/10">
                    <Icon d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
                    Log out
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="no-print pointer-events-none fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2 lg:bottom-4" aria-live="polite">
            <AnimatePresence>
              {toasts.map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40 }}
                  className={`pointer-events-auto rounded-2xl px-4 py-3 text-sm shadow-lg ${t.tone === "err" ? "bg-kumkum text-paper" : t.tone === "new" ? "bg-turmeric text-ink" : "bg-ink text-paper"}`}
                >
                  {t.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </ToastCtx.Provider>
    </RoleCtx.Provider>
  );
}

/** The big open/closed switch. Staff and owner can both flip it; the closed message is editable. */
function OrdersSwitch({ initial }: { initial: Settings }) {
  const toast = useToast();
  const [open, setOpen] = useState(initial.orders_open);
  const [editing, setEditing] = useState(false);
  const [msgEn, setMsgEn] = useState(initial.closed_message_en ?? "");
  const [msgTa, setMsgTa] = useState(initial.closed_message_ta ?? "");
  const [busy, setBusy] = useState(false);
  const sb = supabaseBrowser()!;

  useEffect(() => {
    const ch = sb
      .channel("admin-settings")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, ({ new: row }) => setOpen(row.orders_open))
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [sb]);

  const apply = async (next: boolean) => {
    setBusy(true);
    const { error } = await sb.rpc("set_orders_open", { p_open: next, p_message_en: msgEn || null, p_message_ta: msgTa || null });
    setBusy(false);
    if (error) return toast(error.message, "err");
    setOpen(next);
    setEditing(false);
    toast(next ? "Online orders are OPEN" : "Online orders are CLOSED");
  };

  return (
    <div className="relative">
      <button
        onClick={() => (open ? setEditing(true) : apply(true))}
        disabled={busy}
        className={`flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4 text-sm transition-colors ${open ? "bg-leaf text-paper" : "bg-kumkum text-paper"}`}
        aria-pressed={open}
      >
        <span className="relative h-7 w-12 rounded-full bg-paper/25">
          <motion.span className="absolute top-1 h-5 w-5 rounded-full bg-paper" animate={{ left: open ? 26 : 4 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
        </span>
        <span className="sm:hidden">{open ? "Open" : "Closed"}</span>
        <span className="hidden sm:inline">{open ? "Taking orders" : "Orders closed"}</span>
      </button>
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute right-0 top-full z-40 mt-2 w-[min(90vw,380px)] rounded-2xl bg-paper p-4 shadow-[0_24px_48px_-20px_rgba(42,26,18,.45),inset_0_0_0_1px_var(--rule)]"
          >
            <p className="font-medium">Close online orders?</p>
            <p className="mb-3 text-sm text-ink-soft">Customers can still browse. Walk-in billing keeps working.</p>
            <label className="label">Message (English)</label>
            <input className="field mb-3" value={msgEn} onChange={(e) => setMsgEn(e.target.value)} />
            <label className="label">Message (Tamil)</label>
            <input className="field tamil" value={msgTa} onChange={(e) => setMsgTa(e.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setEditing(false)}>
                Keep open
              </button>
              <button className="btn" style={{ ["--bg" as string]: "var(--kumkum)" }} onClick={() => apply(false)} disabled={busy}>
                Close orders
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Friendly text for errors raised by the stock functions. */
export function rpcMessage(message: string) {
  if (message.startsWith("OUT_OF_STOCK")) return `Not enough stock: ${message.split(":")[1] ?? ""}`;
  const map: Record<string, string> = {
    NOT_ENOUGH_STOCK: "Not enough stock for that.",
    AWAITING_PAYMENT: "This order hasn't been paid yet.",
    ORDER_CANCELLED: "This order is cancelled.",
    BAD_VALUE: "Enter a valid amount.",
    ITEM_UNAVAILABLE: "An item is no longer available.",
  };
  return map[message] ?? message;
}
