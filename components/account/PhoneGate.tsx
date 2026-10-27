"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { validateName } from "@/lib/validate";
import { MobileInput, mobileOk } from "./MobileInput";

/** First-time name + mobile number after signing up (email code or Google). Strict template on both. */
export function PhoneGate({ next, defaultName }: { next: string; defaultName: string }) {
  const t = useTranslations("welcome");
  const tn = useTranslations("name");
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [touched, setTouched] = useState(Boolean(defaultName));
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameCheck = validateName(name);
  const valid = nameCheck.ok && mobileOk(phone);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !nameCheck.ok) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profile/phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, name: nameCheck.clean }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      const key = j.reason ? `err.${j.reason}` : `err.${j.error}`;
      return setError(t.has(key) ? t(key) : t("err.generic"));
    }
    router.replace(next);
    router.refresh();
  };

  return (
    <motion.form onSubmit={save} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-4" noValidate>
      <div>
        <label className="label" htmlFor="w-name">{t("name")}</label>
        <input
          id="w-name"
          className={`field text-lg ${touched && !nameCheck.ok ? "!border-kumkum" : ""}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          maxLength={60}
          autoComplete="name"
          aria-invalid={(touched && !nameCheck.ok) || undefined}
          aria-describedby="w-name-hint"
        />
        <p id="w-name-hint" className={`mt-2 min-h-5 text-sm ${touched && !nameCheck.ok ? "text-kumkum" : "text-ink-mute"}`}>
          {touched && !nameCheck.ok ? tn(`err.${nameCheck.reason}`) : tn("hint")}
        </p>
      </div>
      <MobileInput id="w-phone" label={t("phone")} value={phone} onChange={setPhone} autoFocus={Boolean(defaultName)} />
      <button className="btn w-full" disabled={!valid || busy}>
        {busy ? "…" : t("save")}
      </button>
      {error && (
        <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} role="alert" className="text-sm text-kumkum">
          {error}
        </motion.p>
      )}
    </motion.form>
  );
}
