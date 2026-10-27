"use client";

import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useStore } from "./StoreProvider";

/** Appears (live) the moment the shop closes orders. */
export function ClosedBanner() {
  const { settings } = useStore();
  const locale = useLocale();
  const t = useTranslations("closed");
  const message = (locale === "ta" ? settings.closed_message_ta : settings.closed_message_en) || t("banner");

  return (
    <AnimatePresence>
      {!settings.orders_open && (
        <motion.div
          role="status"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-3 bg-maroon px-[var(--gutter)] py-3 text-center text-sm text-paper"
        >
          <span className="dot-live" data-closed="true" style={{ background: "var(--turmeric)" }} />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
