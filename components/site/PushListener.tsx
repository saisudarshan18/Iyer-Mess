"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { chime } from "@/lib/chime";
import { pushSupported } from "@/lib/push-client";

type Payload = { title: string; body: string; url: string };

/**
 * When a push arrives while the site is open, the service worker forwards it here:
 * play the chime and slide in a card (the system notification still shows too).
 */
export function PushListener() {
  const [note, setNote] = useState<(Payload & { id: number }) | null>(null);

  useEffect(() => {
    if (!pushSupported()) return;
    // keep the worker registered so it can deliver notifications later
    if (Notification.permission === "granted") navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== "iyer-push") return;
      chime();
      setNote({ ...(e.data.payload as Payload), id: Date.now() });
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 7000);
    return () => clearTimeout(id);
  }, [note]);

  return (
    <AnimatePresence>
      {note && (
        <motion.div
          key={note.id}
          role="status"
          initial={{ opacity: 0, y: -30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="fixed left-1/2 top-4 z-[90] w-[min(92vw,420px)] -translate-x-1/2"
        >
          <Link href={note.url} onClick={() => setNote(null)} className="flex items-start gap-3 rounded-2xl bg-ink p-4 text-paper shadow-2xl">
            <motion.span animate={{ rotate: [0, -20, 16, -10, 6, 0] }} transition={{ duration: 0.9 }} className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-turmeric text-ink">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </motion.span>
            <span>
              <span className="block font-medium">{note.title}</span>
              <span className="block text-sm text-paper/75">{note.body}</span>
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
