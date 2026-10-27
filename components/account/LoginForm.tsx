"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { OTP_LENGTH } from "@/lib/auth";
import { supabaseBrowser } from "@/lib/supabase/client";

const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Where to go after logging in: the mobile-number step first if the account has none. */
export async function afterLoginPath(next: string) {
  const sb = supabaseBrowser()!;
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return next;
  const { data: p } = await sb.from("profiles").select("phone").eq("id", u.user.id).single();
  return p?.phone ? next : `/welcome?next=${encodeURIComponent(next)}`;
}

export function LoginForm({ next, nonce }: { next: string; nonce?: string }) {
  const t = useTranslations("login");
  const router = useRouter();
  const sb = supabaseBrowser();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // only accounts we gave a password (e.g. the payment gateway's reviewer) can use this
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  // Cloudflare Turnstile: Supabase verifies the token before it emails a code
  const [captcha, setCaptcha] = useState<string | null>(null);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const renderTurnstile = () => {
    if (!TURNSTILE_KEY || !window.turnstile || !widget.current || widgetId.current) return;
    widgetId.current = window.turnstile.render(widget.current, {
      sitekey: TURNSTILE_KEY,
      theme: "light",
      callback: (tok: string) => setCaptcha(tok),
      "expired-callback": () => setCaptcha(null),
    });
  };
  // the widget lives on the email step; re-render it whenever that step mounts
  useEffect(() => {
    if (step !== "email") return;
    widgetId.current = undefined;
    setCaptcha(null);
    renderTurnstile();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  if (!sb) return <p className="rounded-2xl bg-paper-2 p-6 text-ink-soft">{t("notConfigured")}</p>;

  const address = email.trim().toLowerCase();

  const send = async () => {
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, ...(captcha ? { captchaToken: captcha } : {}) },
    });
    setBusy(false);
    // a token works once; get a fresh one for "resend"
    if (TURNSTILE_KEY) {
      window.turnstile?.reset(widgetId.current);
      setCaptcha(null);
    }
    if (error) return setError(friendly(error.message));
    setStep("code");
    setCooldown(45);
    setTimeout(() => boxes.current[0]?.focus(), 350);
  };

  const signInWithPassword = async () => {
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.signInWithPassword({ email: address, password, options: captcha ? { captchaToken: captcha } : undefined });
    if (TURNSTILE_KEY) {
      window.turnstile?.reset(widgetId.current);
      setCaptcha(null);
    }
    if (error) {
      setBusy(false);
      return setError(/invalid login credentials/i.test(error.message) ? t("badPassword") : friendly(error.message));
    }
    router.replace(await afterLoginPath(next));
    router.refresh();
  };

  const verify = async (digits: string[]) => {
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.verifyOtp({ email: address, token: digits.join(""), type: "email" });
    if (error) {
      setBusy(false);
      setError(friendly(error.message));
      setCode(Array(OTP_LENGTH).fill(""));
      boxes.current[0]?.focus();
      return;
    }
    router.replace(await afterLoginPath(next));
    router.refresh();
  };

  const withGoogle = async () => {
    setGoogle(true);
    setError(null);
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`, queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setGoogle(false);
      setError(friendly(error.message));
    }
  };

  const setDigit = (i: number, value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      const nextCode = [...code];
      nextCode[i] = "";
      setCode(nextCode);
      return;
    }
    // typing one digit, or pasting the whole code into any box
    const nextCode = [...code];
    for (let k = 0; k < digits.length && i + k < OTP_LENGTH; k++) nextCode[i + k] = digits[k];
    setCode(nextCode);
    const focus = Math.min(OTP_LENGTH - 1, i + digits.length);
    boxes.current[focus]?.focus();
    if (nextCode.every(Boolean)) verify(nextCode);
  };

  function friendly(message: string) {
    if (/rate limit|too many/i.test(message)) return t("tooMany");
    if (/expired|invalid/i.test(message)) return t("badCode");
    if (/captcha/i.test(message)) return t("captcha");
    return message;
  }

  return (
    <div className="relative">
      {TURNSTILE_KEY && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" nonce={nonce} onReady={renderTurnstile} />}
      <AnimatePresence mode="wait" initial={false}>
        {step === "email" ? (
          <motion.div key="email" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <button
              type="button"
              onClick={withGoogle}
              disabled={google}
              className="group flex min-h-[54px] w-full items-center justify-center gap-3 rounded-full bg-white px-5 font-medium text-ink shadow-[inset_0_0_0_1px_var(--rule),0_8px_20px_-14px_rgba(42,26,18,.5)] transition-[box-shadow,transform] hover:shadow-[inset_0_0_0_1px_var(--ink),0_10px_24px_-14px_rgba(42,26,18,.6)] active:scale-[0.98] disabled:opacity-60"
            >
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden className="transition-transform duration-500 group-hover:rotate-[360deg]">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              {google ? t("googleBusy") : t("google")}
            </button>

            <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-ink-mute">
              <span className="h-px flex-1 bg-rule" />
              {t("or")}
              <span className="h-px flex-1 bg-rule" />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!EMAIL_RE.test(address)) return;
                if (usePassword) signInWithPassword();
                else send();
              }}
            >
              <label className="label" htmlFor="email">
                {t("email")}
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                className="field text-lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              {usePassword && (
                <>
                  <label className="label mt-4" htmlFor="password">
                    {t("password")}
                  </label>
                  <input id="password" type="password" autoComplete="current-password" className="field text-lg" value={password} onChange={(e) => setPassword(e.target.value)} />
                </>
              )}
              {TURNSTILE_KEY && <div ref={widget} className="mt-4 min-h-[65px]" />}
              <button className="btn mt-5 w-full" disabled={!EMAIL_RE.test(address) || busy || (!!TURNSTILE_KEY && !captcha) || (usePassword && password.length < 8)}>
                {busy ? "…" : usePassword ? t("passwordLogin") : t("send")}
              </button>
              <button type="button" className="ink-link mx-auto mt-4 block text-xs text-ink-mute" onClick={() => (setUsePassword((u) => !u), setError(null))}>
                {usePassword ? t("withCode") : t("withPassword")}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div key="code" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}>
            <p className="label">{t("code")}</p>
            <p className="mb-4 text-sm text-ink-soft">{t.rich("sentTo", { email: address, b: (c) => <b className="text-ink">{c}</b> })}</p>
            <div
              className="flex justify-between gap-2"
              onPaste={(e) => {
                e.preventDefault();
                setDigit(0, e.clipboardData.getData("text"));
              }}
            >
              {code.map((d, i) => (
                <motion.input
                  key={i}
                  ref={(el) => {
                    boxes.current[i] = el;
                  }}
                  aria-label={`Digit ${i + 1}`}
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  maxLength={6}
                  value={d}
                  disabled={busy}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !code[i] && i > 0) boxes.current[i - 1]?.focus();
                  }}
                  animate={d ? { scale: [1, 1.12, 1], borderColor: "#2a1a12" } : { scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="lnum aspect-[4/5] w-full min-w-0 rounded-[14px] border border-rule bg-[color-mix(in_oklab,var(--paper)_60%,white)] text-center text-2xl outline-none focus:border-ink focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--turmeric)_35%,transparent)]"
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-mute">{t("checkSpam")}</p>
            <div className="mt-5 flex items-center justify-between text-sm">
              <button className="ink-link" onClick={() => setStep("email")}>
                {t("change")}
              </button>
              {/* resending needs a fresh bot check, which lives on the email step */}
              <button className="ink-link disabled:opacity-40" disabled={cooldown > 0 || busy} onClick={TURNSTILE_KEY ? () => setStep("email") : send}>
                {t("resend")} {cooldown > 0 && <span className="lnum">({cooldown})</span>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && (
        <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 text-sm text-kumkum" role="alert">
          {error}
        </motion.p>
      )}
    </div>
  );
}
