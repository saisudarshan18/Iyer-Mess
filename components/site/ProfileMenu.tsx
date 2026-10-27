"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLenis } from "@/components/motion/SmoothScroll";

export type Viewer = { name: string | null; email: string | null; phone: string | null; role: "customer" | "staff" | "owner" } | null;

const initialOf = (v: NonNullable<Viewer>) => ((v.name?.trim() || v.email || "")[0] ?? "").toUpperCase() || "☺";
const prettyPhone = (p: string | null) => (p ? `+91 ${p.slice(-10, -5)} ${p.slice(-5)}` : "");

/** Avatar button → dropdown with the account shortcuts and log out. */
export function ProfileMenu({ viewer }: { viewer: Viewer }) {
  const t = useTranslations("account");
  const tn = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [phone, setPhone] = useState(false);
  const pathname = usePathname();
  const lenis = useLenis();

  useEffect(() => setOpen(false), [pathname]);
  // on phones the menu is a sheet over the page; don't let the page scroll behind it
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (open && phone) {
      lenis?.stop();
      return () => lenis?.start();
    }
  }, [open, phone, lenis]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node) && !sheet.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!viewer) {
    return (
      <Link href="/login" className="ink-link hidden text-sm sm:inline">
        {tn("login")}
      </Link>
    );
  }

  // signed in, but the mobile-number step isn't done yet: only finish or leave
  const unfinished = !viewer.phone;
  const items = unfinished
    ? [{ href: `/welcome?next=${encodeURIComponent(pathname.startsWith("/welcome") ? "/orders" : pathname)}`, label: t("finish"), icon: "M12 5v14M5 12h14" }]
    : [
    { href: "/orders", label: t("orders"), icon: "M4 7h16M4 12h16M4 17h10" },
    { href: "/account#profile", label: t("profile"), icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" },
    { href: "/account#addresses", label: t("addresses"), icon: "M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" },
    { href: "/account#payments", label: t("payments"), icon: "M3 7h18v10H3zM3 11h18" },
    { href: "/account#notifications", label: t("notifications"), icon: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" },
    ...(viewer.role !== "customer" ? [{ href: "/admin", label: t("admin"), icon: "M4 20V10l8-6 8 6v10h-5v-6H9v6z" }] : []),
      ];

  const menu = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[2px] sm:hidden"
          aria-hidden
        />
      )}
      {open && (
        <motion.div
          key="menu"
          ref={sheet}
          role="menu"
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-3 top-[86px] z-[60] max-h-[calc(100dvh-100px)] origin-top overflow-y-auto overscroll-contain rounded-[22px] sm:absolute sm:z-50 sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)] sm:max-h-none sm:w-72 sm:origin-top-right sm:overflow-hidden bg-paper shadow-[0_30px_60px_-20px_rgba(42,26,18,.45),inset_0_0_0_1px_var(--rule)]"
        >
          <div className="border-b border-rule bg-paper-2/70 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink-mute">{t("hello")}</p>
            <p className="display mt-1 break-words text-2xl leading-tight">{viewer.name || t("title")}</p>
            {viewer.email && <p className="truncate text-sm text-ink-soft">{viewer.email}</p>}
            {unfinished ? <p className="mt-2 text-xs text-kumkum">{t("unfinished")}</p> : <p className="lnum text-sm text-ink-soft">{prettyPhone(viewer.phone)}</p>}
          </div>
          <ul className="p-2">
            {items.map((it, i) => (
              <motion.li key={it.href} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }}>
                <Link role="menuitem" href={it.href} className="group flex items-center gap-3 rounded-xl px-3 py-3.5 text-base hover:bg-paper-2 sm:py-2.5 sm:text-sm">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" className="text-ink-soft transition-colors group-hover:text-kumkum" aria-hidden>
                    <path d={it.icon} />
                  </svg>
                  {it.label}
                </Link>
              </motion.li>
            ))}
          </ul>
          <form action="/auth/signout" method="post" className="border-t border-rule p-2">
            <button role="menuitem" className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-base text-kumkum hover:bg-kumkum/10 sm:py-2.5 sm:text-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
              </svg>
              {t("logout")}
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("menu")}
        className="group relative grid h-11 w-11 place-items-center rounded-full bg-turmeric font-semibold text-ink shadow-[inset_0_0_0_2px_var(--paper),0_0_0_1px_var(--ink)] transition-transform hover:scale-105"
      >
        <span className="display text-lg leading-none">{initialOf(viewer)}</span>
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-paper bg-leaf" aria-hidden />
      </button>
      {phone ? createPortal(menu, document.body) : menu}
    </div>
  );
}
