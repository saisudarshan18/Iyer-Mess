"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { chime } from "@/lib/chime";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push-client";

/** On/off switch for order notifications on this device, with clear help when the browser can't. */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("account");
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pushState().then(setState);
  }, []);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = state === "on" ? await disablePush() : await enablePush();
      setState(next);
      if (next === "on") chime(0.25);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (state === null) return <div className="skeleton h-12 w-64" />;
  const help =
    state === "denied" ? t("pushDenied") : state === "unsupported" ? t("pushUnsupported") : state === "ios-install" ? t("pushIos") : null;

  return (
    <div>
      <button
        role="switch"
        aria-checked={state === "on"}
        disabled={busy || !!help}
        onClick={toggle}
        className={`group flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-5 text-sm transition-colors disabled:opacity-50 ${state === "on" ? "bg-leaf text-paper" : "bg-paper-2 shadow-[inset_0_0_0_1px_var(--rule)]"}`}
      >
        <span className={`relative h-7 w-12 rounded-full ${state === "on" ? "bg-paper/25" : "bg-ink/15"}`}>
          <motion.span className="absolute top-1 grid h-5 w-5 place-items-center rounded-full bg-paper shadow" animate={{ left: state === "on" ? 26 : 4 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
            <motion.svg key={state} initial={{ rotate: -30, scale: 0.6 }} animate={{ rotate: [0, -18, 14, -8, 0], scale: 1 }} transition={{ duration: 0.7 }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={state === "on" ? "#3f5b2e" : "#8a7462"} strokeWidth="2.4" aria-hidden>
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </motion.svg>
          </motion.span>
        </span>
        {busy ? t("pushWorking") : state === "on" ? (compact ? t("notifications") : t("pushOn")) : t("pushOff")}
      </button>
      <AnimatePresence>
        {(help || error) && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 max-w-md text-sm text-ink-soft">
            {error ?? help}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
