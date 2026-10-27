"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { fireConfetti } from "@/components/motion/Confetti";
import { telUrl, whatsappUrl } from "@/lib/links";
import { useStore } from "./StoreProvider";
import { WA_PATH } from "./WhatsAppButton";
import { MobileInput, mobileOk } from "@/components/account/MobileInput";

const TOPICS = ["order", "bulk", "feedback", "other"] as const;

/** Support cards (call, WhatsApp, email, hours) beside a message form with an animated thank-you. */
export function ContactSection({ defaults }: { defaults: { name: string; phone: string; email: string } }) {
  const t = useTranslations("contact");
  const { settings } = useStore();
  const phone = settings.shop_phone;
  const wa = whatsappUrl(settings.whatsapp_number ?? phone, t("waText"));

  const cards = [
    phone && { href: telUrl(phone), title: t("call"), value: phone, icon: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" },
    wa && { href: wa, title: t("whatsapp"), value: t("whatsappCta"), wa: true, external: true },
    settings.support_email && { href: `mailto:${settings.support_email}`, title: t("email"), value: settings.support_email, icon: "M3 6h18v12H3zM3 7l9 6 9-6" },
    settings.support_hours && { title: t("hours"), value: settings.support_hours, icon: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" },
  ].filter(Boolean) as { href?: string; title: string; value: string; icon?: string; wa?: boolean; external?: boolean }[];

  return (
    <section className="px-[var(--gutter)] pb-10 pt-32 md:pt-40">
      <h1 className="display text-[clamp(3.2rem,8vw,7.5rem)]">{t("title")}</h1>
      <p className="mt-4 max-w-xl text-lg text-ink-soft">{t("sub")}</p>

      <div className="mt-14 grid gap-12 lg:grid-cols-12">
        <ul className="grid content-start gap-3 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
          {cards.map((c, i) => {
            const body = (
              <>
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${c.wa ? "bg-[#25D366] text-white" : "bg-ink text-paper"} transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-110`}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill={c.wa ? "currentColor" : "none"} stroke={c.wa ? "none" : "currentColor"} strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
                    <path d={c.wa ? WA_PATH : c.icon} />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-xs uppercase tracking-[0.2em] text-ink-mute">{c.title}</span>
                  <span className="lnum block truncate text-lg">{c.value}</span>
                </span>
              </>
            );
            return (
              <motion.li key={c.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }}>
                {c.href ? (
                  <a href={c.href} target={c.external ? "_blank" : undefined} rel={c.external ? "noopener noreferrer" : undefined} className="group flex items-center gap-4 rounded-[22px] bg-paper-2 p-5 transition-colors hover:bg-paper-3">
                    {body}
                  </a>
                ) : (
                  <div className="group flex items-center gap-4 rounded-[22px] bg-paper-2 p-5">{body}</div>
                )}
              </motion.li>
            );
          })}
        </ul>
        <div className="lg:col-span-7">
          <ContactForm defaults={defaults} />
        </div>
      </div>
    </section>
  );
}

function ContactForm({ defaults }: { defaults: { name: string; phone: string; email: string } }) {
  const t = useTranslations("contact");
  const [form, setForm] = useState({ name: defaults.name, phone: defaults.phone, email: defaults.email, topic: "order" as (typeof TOPICS)[number], order_code: "", message: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [bad, setBad] = useState<string[]>([]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBad([]);
    if (form.phone && !mobileOk(form.phone)) {
      setBad(["phone"]);
      return setError(t("badPhone"));
    }
    if (!form.phone && !form.email) {
      setBad(["phone", "email"]);
      return setError(t("needContact"));
    }
    setState("sending");
    const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) {
      setState("sent");
      fireConfetti({ x: 0.7, y: 0.45 });
      return;
    }
    const j = await res.json().catch(() => ({}));
    setState("idle");
    setBad(j.issues ?? []);
    setError(j.error === "NEED_CONTACT" ? t("needContact") : j.error === "BAD_PHONE" ? t("badPhone") : t("error"));
  };

  const field = (k: string) => `field ${bad.includes(k) ? "!border-kumkum" : ""}`;

  return (
    <div className="relative overflow-hidden rounded-[32px] bg-paper p-6 shadow-[0_40px_80px_-40px_rgba(42,26,18,.45),inset_0_0_0_1px_var(--rule)] md:p-10">
      <AnimatePresence mode="wait">
        {state === "sent" ? (
          <motion.div key="sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-10 text-center">
            <svg viewBox="0 0 52 52" width="88" height="88" className="mx-auto" aria-hidden>
              <motion.circle cx="26" cy="26" r="24" fill="none" stroke="#3f5b2e" strokeWidth="2.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
              <motion.path d="M15 27l7 7 15-16" fill="none" stroke="#3f5b2e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.5 }} />
            </svg>
            <p className="display mt-6 text-3xl">{t("sent")}</p>
            <button className="btn btn-ghost mt-8" onClick={() => (setForm({ ...form, message: "", order_code: "" }), setState("idle"))}>
              {t("another")}
            </button>
          </motion.div>
        ) : (
          <motion.form key="form" exit={{ opacity: 0, y: -10 }} onSubmit={submit} className="grid gap-5 sm:grid-cols-2" noValidate>
            <h2 className="display text-4xl sm:col-span-2">{t("formTitle")}</h2>
            <div className="sm:col-span-2">
              <span className="label">{t("topic")}</span>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                {TOPICS.map((k) => (
                  <button type="button" key={k} role="radio" aria-checked={form.topic === k} onClick={() => setForm({ ...form, topic: k })} className="chip">
                    {t(`topics.${k}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="c-name">{t("name")}</label>
              <input id="c-name" required className={field("name")} value={form.name} onChange={set("name")} maxLength={120} autoComplete="name" />
            </div>
            <MobileInput id="c-phone" label={t("phone")} value={form.phone} onChange={(d) => setForm({ ...form, phone: d })} optional />
            <div>
              <label className="label" htmlFor="c-email">{t("email2")}</label>
              <input id="c-email" type="email" className={field("email")} value={form.email} onChange={set("email")} maxLength={200} autoComplete="email" />
            </div>
            <AnimatePresence initial={false}>
              {form.topic === "order" ? (
                <motion.div key="code" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <label className="label" htmlFor="c-code">{t("orderCode")}</label>
                  <input id="c-code" className="field lnum uppercase" placeholder="IM1001" value={form.order_code} onChange={set("order_code")} maxLength={20} />
                </motion.div>
              ) : (
                <div key="spacer" className="hidden sm:block" />
              )}
            </AnimatePresence>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="c-msg">{t("message")}</label>
              <textarea id="c-msg" required className={`${field("message")} min-h-36`} value={form.message} onChange={set("message")} maxLength={2000} />
              <p className="lnum mt-1 text-right text-xs text-ink-mute">{form.message.length}/2000</p>
            </div>
            {/* honeypot for bots: hidden from people and screen readers */}
            <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" value={form.website} onChange={set("website")} name="website" />
            <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
              <button className="btn shine" disabled={state === "sending" || form.message.trim().length < 5 || !form.name.trim()}>
                {state === "sending" ? t("sending") : t("send")}
              </button>
              {error && (
                <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} role="alert" className="text-sm text-kumkum">
                  {error}
                </motion.p>
              )}
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
