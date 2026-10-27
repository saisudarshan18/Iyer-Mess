"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { cartCount, useCart } from "@/lib/cart-store";
import { Magnetic } from "@/components/motion/Magnetic";
import { useLenis } from "@/components/motion/SmoothScroll";
import { Logo } from "@/components/art/Logo";
import { useStore } from "./StoreProvider";
import { ProfileMenu, type Viewer } from "./ProfileMenu";


export function Header({ viewer }: { viewer: Viewer }) {
  const t = useTranslations();
  const pathname = usePathname();
  const { settings } = useStore();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lenis = useLenis();

  // hide on the way down, return on the way up
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      if (Math.abs(y - last) > 6) setHidden(y > last && y > 240);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (menuOpen) lenis?.stop();
    else lenis?.start();
  }, [menuOpen, lenis]);

  const links = [
    { href: "/menu", label: t("nav.menu") },
    { href: "/combos", label: t("nav.combos") },
    { href: "/#story", label: t("nav.story") },
  ];

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">
        {t("nav.skip")}
      </a>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] ${hidden && !menuOpen ? "-translate-y-full" : ""}`}
      >
        <div
          className={`mx-auto flex items-center justify-between gap-4 px-[var(--gutter)] transition-[padding,background-color,box-shadow] duration-500 ${
            scrolled ? `bg-paper/85 py-3 backdrop-blur-md ${hidden ? "" : "shadow-[0_1px_0_var(--rule)]"}` : "py-5"
          }`}
        >
          <Link href="/" className="group" aria-label="Iyer Mess home">
            <Logo />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-9 md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="ink-link text-[0.98rem]" aria-current={pathname === l.href ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs shadow-[inset_0_0_0_1px_var(--rule)] lg:inline-flex">
              <span className="dot-live" data-closed={!settings.orders_open} />
              {settings.orders_open ? t("status.open") : t("status.closed")}
            </span>
            <LocaleToggle />
            <ProfileMenu viewer={viewer} />
            <CartButton />
            <button
              className="grid h-11 w-11 place-items-center md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label="Menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className="relative block h-3 w-6">
                <span className={`absolute left-0 h-[1.5px] w-full bg-ink transition-transform duration-300 ${menuOpen ? "top-1.5 rotate-45" : "top-0"}`} />
                <span className={`absolute left-0 h-[1.5px] w-full bg-ink transition-transform duration-300 ${menuOpen ? "top-1.5 -rotate-45" : "top-3"}`} />
              </span>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-menu"
            className="fixed inset-0 z-40 flex flex-col justify-between bg-paper px-[var(--gutter)] pb-10 pt-28 md:hidden"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
          >
            <nav aria-label="Mobile" className="flex flex-col gap-2">
              {[...links, ...(viewer ? [{ href: "/orders", label: t("nav.orders") }, { href: "/account", label: t("account.title") }] : [{ href: "/login", label: t("nav.login") }])].map((l, i) => (
                <motion.div key={l.href} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 + i * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                  <Link href={l.href} className="display block py-2 text-6xl">
                    {l.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
            <span className="inline-flex items-center gap-2 text-sm">
              <span className="dot-live" data-closed={!settings.orders_open} />
              {settings.orders_open ? t("status.open") : t("status.closed")}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function LocaleToggle() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (l: "en" | "ta") => {
    if (l === locale) return;
    start(async () => {
      await setLocale(l);
      router.refresh();
    });
  };
  return (
    <div role="radiogroup" aria-label="Language" className={`relative flex rounded-full p-1 shadow-[inset_0_0_0_1px_var(--rule)] ${pending ? "opacity-60" : ""}`}>
      {(["en", "ta"] as const).map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={locale === l}
          onClick={() => choose(l)}
          className={`relative z-10 grid h-8 min-w-9 place-items-center rounded-full px-2 text-xs transition-colors ${locale === l ? "text-paper" : "text-ink"}`}
        >
          {locale === l && <motion.span layoutId="locale-pill" className="absolute inset-0 -z-10 rounded-full bg-ink" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
          {l === "en" ? "EN" : <span className="tamil">த</span>}
        </button>
      ))}
    </div>
  );
}

function CartButton() {
  const t = useTranslations("nav");
  const lines = useCart((s) => s.lines);
  const bump = useCart((s) => s.bump);
  const setOpen = useCart((s) => s.setOpen);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? cartCount(lines) : 0;

  return (
    <Magnetic strength={0.4}>
      <button
        data-cart-target
        onClick={() => setOpen(true)}
        className="relative grid h-11 w-11 place-items-center rounded-full bg-ink text-paper transition-transform hover:scale-105"
        aria-label={`${t("cart")} (${count})`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M4 9h16l-1.4 10.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8L4 9Z" />
          <path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" />
        </svg>
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              key={bump}
              initial={{ scale: 0.4 }}
              animate={{ scale: [1.5, 0.9, 1] }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="lnum absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-turmeric px-1 text-[11px] font-semibold text-ink"
            >
              {count}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </Magnetic>
  );
}
