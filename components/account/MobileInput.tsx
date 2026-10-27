"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { formatMobile, validateMobile } from "@/lib/validate";

/**
 * Indian mobile number in a fixed "+91 _____ _____" template. Fills as you type,
 * numeric keypad, and a live verdict once all 10 digits are in (green tick, or why
 * the number looks wrong). `value` is the 10 digits only.
 */
export function MobileInput({
  id,
  value,
  onChange,
  label,
  optional = false,
  autoFocus = false,
}: {
  id: string;
  value: string;
  onChange: (digits: string) => void;
  label?: string;
  optional?: boolean;
  autoFocus?: boolean;
}) {
  const t = useTranslations("mobile");
  const digits = value.replace(/\D/g, "").slice(0, 10);
  const verdict = digits.length === 10 ? validateMobile(digits) : null;
  const bad = verdict && !verdict.ok;
  const good = verdict?.ok;
  // the empty template behind what's typed, so the shape is always visible
  const ghost = "_____ _____".slice(formatMobile(digits).length);

  return (
    <div>
      {label && (
        <label className="label" htmlFor={id}>
          {label}
          {optional && <span className="ml-1 normal-case tracking-normal text-ink-mute">({t("optional")})</span>}
        </label>
      )}
      <div
        className={`flex items-stretch overflow-hidden rounded-[14px] border bg-[color-mix(in_oklab,var(--paper)_60%,white)] transition-[border-color,box-shadow] focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--turmeric)_35%,transparent)] ${
          bad ? "border-kumkum" : good ? "border-leaf" : "border-rule focus-within:border-ink"
        }`}
      >
        <span className="lnum grid place-items-center border-r border-rule px-4 text-ink-soft">+91</span>
        <div className="relative min-w-0 flex-1">
          {/* ghost template */}
          <span aria-hidden className="lnum pointer-events-none absolute inset-0 flex items-center whitespace-pre px-4 text-xl tracking-[0.12em]">
            <span className="invisible">{formatMobile(digits)}</span>
            <span className="text-ink/25">{ghost}</span>
          </span>
          <input
            id={id}
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus={autoFocus}
            aria-invalid={bad || undefined}
            aria-describedby={`${id}-hint`}
            className="lnum relative min-h-[56px] w-full bg-transparent px-4 text-xl tracking-[0.12em] outline-none"
            value={formatMobile(digits)}
            onChange={(e) => {
              // tolerate pasted "+91 98765 43210" / "09876543210"
              let d = e.target.value.replace(/\D/g, "");
              if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
              if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
              onChange(d.slice(0, 10));
            }}
          />
        </div>
        <AnimatePresence>
          {good && (
            <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} className="grid w-12 place-items-center text-leaf" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <p id={`${id}-hint`} role={bad ? "alert" : undefined} className={`mt-2 min-h-5 text-sm ${bad ? "text-kumkum" : "text-ink-mute"}`}>
        {bad ? t(`err.${verdict.reason}`) : digits.length > 0 && digits.length < 10 ? t("left", { n: 10 - digits.length }) : t("hint")}
      </p>
    </div>
  );
}

export const mobileOk = (digits: string) => digits.length === 10 && validateMobile(digits).ok;
