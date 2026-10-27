"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { whatsappUrl } from "@/lib/links";
import { useStore } from "./StoreProvider";

export const WA_PATH = "M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3M12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4c-1-1.6-1.5-3.4-1.5-5.2C2.2 6.6 6.6 2.2 12 2.2c2.6 0 5.1 1 6.9 2.9 1.8 1.8 2.9 4.3 2.9 6.9 0 5.4-4.4 9.8-9.8 9.8M20.4 3.6A11.8 11.8 0 0 0 12 .2C5.5.2.2 5.5.2 12c0 2.1.5 4.1 1.6 5.9L.1 24l6.3-1.7c1.7.9 3.6 1.4 5.6 1.4 6.5 0 11.8-5.3 11.8-11.8 0-3.2-1.2-6.1-3.4-8.3";

/** Floating "chat on WhatsApp" button; it waves hello once, then waits quietly. */
export function WhatsAppButton() {
  const t = useTranslations("contact");
  const { settings } = useStore();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [hint, setHint] = useState(false);
  const href = whatsappUrl(settings.whatsapp_number ?? settings.shop_phone, t("waText"));

  useEffect(() => {
    const show = setTimeout(() => setHint(true), 6000);
    const hide = setTimeout(() => setHint(false), 12000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  if (!href || pathname.startsWith("/checkout")) return null;

  return (
    <div className={`fixed right-4 z-40 flex items-center gap-3 md:right-6 ${settings.orders_open ? "bottom-4 md:bottom-6" : "bottom-16 md:bottom-16"}`}>
      <AnimatePresence>
        {hint && (
          <motion.span
            initial={{ opacity: 0, x: 10, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10 }}
            className="hidden rounded-full bg-paper px-4 py-2 text-sm shadow-[0_10px_30px_-10px_rgba(42,26,18,.4),inset_0_0_0_1px_var(--rule)] sm:block"
          >
            {t("whatsappCta")}
          </motion.span>
        )}
      </AnimatePresence>
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("whatsappCta")}
        onPointerEnter={() => setHint(true)}
        onPointerLeave={() => setHint(false)}
        initial={reduce ? false : { scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 1.2 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        className="relative grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_-8px_rgba(37,211,102,.6)]"
      >
        {!reduce && <span className="absolute inset-0 animate-[ping_2.8s_cubic-bezier(0,0,.2,1)_3] rounded-full bg-[#25D366]/50" aria-hidden />}
        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden>
          <path d={WA_PATH} />
        </svg>
      </motion.a>
    </div>
  );
}
