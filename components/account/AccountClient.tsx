"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AddressPicker, type PickedAddress } from "@/components/checkout/AddressPicker";
import { useStore } from "@/components/site/StoreProvider";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { AddressLabel, PaymentMode, SavedAddress } from "@/lib/types";
import { MobileInput, mobileOk } from "./MobileInput";
import { PushToggle } from "./PushToggle";

type Profile = { id: string; name: string | null; email: string | null; phone: string | null; preferred_payment: PaymentMode | null; whatsapp_updates: boolean };
export type LoginMethod = { provider: string; email: string | null };

export const LABEL_ICON: Record<AddressLabel, string> = {
  home: "M4 11 12 4l8 7v9h-5v-6H9v6H4z",
  work: "M4 8h16v12H4zM9 8V5h6v3M4 13h16",
  other: "M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
};

export function LabelIcon({ label, className }: { label: AddressLabel; className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" className={className} aria-hidden>
      <path d={LABEL_ICON[label]} />
    </svg>
  );
}

export function AccountClient({ profile, addresses: initial, methods = [] }: { profile: Profile; addresses: SavedAddress[]; methods?: LoginMethod[] }) {
  const t = useTranslations("account");
  return (
    <section className="px-[var(--gutter)] pb-28 pt-32 md:pt-40">
      <h1 className="display text-[clamp(3.2rem,8vw,7rem)]">{t("title")}</h1>
      <p className="mt-2 text-ink-soft">{profile.email}</p>

      <div className="mt-14 grid gap-14 lg:grid-cols-12">
        <nav className="hidden lg:col-span-3 lg:block" aria-label={t("menu")}>
          <ul className="sticky top-28 space-y-1">
            {(["profile", "addresses", "payments", "notifications"] as const).map((k) => (
              <li key={k}>
                <a href={`#${k}`} className="ink-link block py-1.5 text-lg">
                  {t(k)}
                </a>
              </li>
            ))}
            <li className="pt-4">
              <form action="/auth/signout" method="post">
                <button className="text-kumkum hover:underline">{t("logout")}</button>
              </form>
            </li>
          </ul>
        </nav>
        <div className="space-y-16 lg:col-span-8 lg:col-start-5">
          <ProfileForm profile={profile} methods={methods} />
          <Addresses userId={profile.id} initial={initial} />
          <PaymentPref profile={profile} />
          <Block id="notifications" title={t("pushTitle")} sub={t("pushSub")}>
            <PushToggle />
            <WhatsAppPref profile={profile} />
          </Block>
          <form action="/auth/signout" method="post" className="border-t border-rule pt-8 lg:hidden">
            <button className="btn btn-ghost !text-kumkum">{t("logout")}</button>
          </form>
        </div>
      </div>
    </section>
  );
}

function Block({ id, title, sub, children }: { id: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-28 border-t border-rule pt-8">
      <h2 className="display text-[clamp(2rem,3.5vw,3rem)]">{title}</h2>
      {sub && <p className="mb-6 mt-2 max-w-lg text-ink-soft">{sub}</p>}
      <div className={sub ? "" : "mt-6"}>{children}</div>
    </div>
  );
}

function useSavedFlash() {
  const [saved, setSaved] = useState(false);
  return { saved, flash: () => (setSaved(true), setTimeout(() => setSaved(false), 1800)) };
}

function ProfileForm({ profile, methods }: { profile: Profile; methods: LoginMethod[] }) {
  const t = useTranslations("account");
  const router = useRouter();
  const sb = supabaseBrowser()!;
  const [name, setName] = useState(profile.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { saved, flash } = useSavedFlash();

  return (
    <Block id="profile" title={t("details")}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const { error } = await sb.from("profiles").update({ name: name.trim() || null }).eq("id", profile.id);
          setBusy(false);
          if (error) return setError(error.message);
          flash();
          router.refresh();
        }}
      >
        <div>
          <label className="label" htmlFor="pname">{t("name")}</label>
          <input id="pname" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="pemail">{t("email")}</label>
          <input id="pemail" type="email" className="field !bg-paper-2 text-ink-soft" value={profile.email ?? ""} readOnly aria-describedby="pemail-note" />
        </div>
        <p id="pemail-note" className="text-sm text-ink-mute sm:col-span-2">{t("emailNote")}</p>
        <div className="flex items-center gap-4">
          <button className="btn" disabled={busy}>{t("save")}</button>
          <SavedTick show={saved} />
        </div>
        {error && <p className="text-sm text-kumkum sm:col-span-2">{error}</p>}
      </form>
      <LoginMethods methods={methods} email={profile.email} />
      <ChangePhone current={profile.phone} />
    </Block>
  );
}

function SavedTick({ show }: { show: boolean }) {
  const t = useTranslations("account");
  return (
    <AnimatePresence>
      {show && (
        <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-sm text-leaf">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
            <motion.path d="M4 12.5l5 5L20 6.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
          </svg>
          {t("saved")}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function Addresses({ userId, initial }: { userId: string; initial: SavedAddress[] }) {
  const t = useTranslations("account");
  const sb = supabaseBrowser()!;
  const { settings } = useStore();
  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const { data } = await sb.from("addresses").select("*").eq("user_id", userId).order("created_at");
    setList((data ?? []) as SavedAddress[]);
  };

  const makeDefault = async (a: SavedAddress) => {
    await sb.from("addresses").update({ is_default: false }).eq("user_id", userId).eq("is_default", true);
    await sb.from("addresses").update({ is_default: true }).eq("id", a.id);
    reload();
  };
  const remove = async (a: SavedAddress) => {
    if (!confirm(`${t("deleteAddr")}?`)) return;
    await sb.from("addresses").delete().eq("id", a.id);
    reload();
  };

  return (
    <Block id="addresses" title={t("addrTitle")} sub={t("addrSub")}>
      <ul className="grid gap-3 sm:grid-cols-2">
        <AnimatePresence initial={false}>
          {list.map((a) => (
            <motion.li key={a.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`rounded-[20px] p-5 ${a.is_default ? "bg-turmeric/25 shadow-[inset_0_0_0_1.5px_var(--ink)]" : "bg-paper-2"}`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <LabelIcon label={a.label} className="text-maroon" />
                  {t(a.label)}
                </span>
                {a.is_default && <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-paper">{t("default")}</span>}
              </div>
              <p className="mt-3 line-clamp-3 text-sm">{a.line}</p>
              {a.landmark && <p className="mt-1 text-sm text-ink-soft">{a.landmark}</p>}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <button className="ink-link" onClick={() => setEditing(a)}>{t("editAddr")}</button>
                {!a.is_default && <button className="ink-link" onClick={() => makeDefault(a)}>{t("makeDefault")}</button>}
                <button className="ink-link text-kumkum" onClick={() => remove(a)}>{t("deleteAddr")}</button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
        {list.length === 0 && !editing && <li className="text-ink-soft">{t("noAddr")}</li>}
      </ul>

      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div key="editor" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <AddressEditor
              userId={userId}
              existing={editing === "new" ? null : editing}
              taken={list.filter((x) => editing === "new" || x.id !== editing.id).map((x) => x.label)}
              center={settings.shop_lat !== null && settings.shop_lng !== null ? { lat: settings.shop_lat, lng: settings.shop_lng } : null}
              isFirst={list.length === 0}
              onDone={() => (setEditing(null), reload())}
              onError={setError}
            />
          </motion.div>
        ) : (
          <motion.button key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="btn btn-ghost mt-6" onClick={() => (setError(null), setEditing("new"))}>
            + {t("addAddr")}
          </motion.button>
        )}
      </AnimatePresence>
      {error && <p className="mt-3 text-sm text-kumkum">{error}</p>}
    </Block>
  );
}

/** Address form shared by the account page and checkout's "save this address". */
export function AddressEditor({
  userId,
  existing,
  taken,
  center,
  isFirst,
  onDone,
  onError,
}: {
  userId: string;
  existing: SavedAddress | null;
  taken: AddressLabel[];
  center: { lat: number; lng: number } | null;
  isFirst: boolean;
  onDone: () => void;
  onError: (m: string | null) => void;
}) {
  const t = useTranslations("account");
  const sb = supabaseBrowser()!;
  const [label, setLabel] = useState<AddressLabel>(existing?.label ?? (taken.includes("home") ? (taken.includes("work") ? "other" : "work") : "home"));
  const [addr, setAddr] = useState<PickedAddress | null>(existing ? { line: existing.line, landmark: existing.landmark ?? "", lat: existing.lat, lng: existing.lng, place_id: existing.place_id ?? undefined } : null);
  const [busy, setBusy] = useState(false);
  const clash = label !== "other" && taken.includes(label);

  const save = async () => {
    if (!addr || clash) return;
    setBusy(true);
    onError(null);
    const row = { user_id: userId, label, line: addr.line, landmark: addr.landmark || null, lat: addr.lat, lng: addr.lng, place_id: addr.place_id ?? null };
    const { error } = existing ? await sb.from("addresses").update(row).eq("id", existing.id) : await sb.from("addresses").insert({ ...row, is_default: isFirst });
    setBusy(false);
    if (error) return onError(error.message);
    onDone();
  };

  return (
    <div className="mt-6 rounded-[24px] bg-paper-2/60 p-5 md:p-6">
      <p className="label">{t("label")}</p>
      <div className="mb-5 flex flex-wrap gap-2" role="radiogroup">
        {(["home", "work", "other"] as const).map((l) => (
          <button key={l} type="button" role="radio" aria-checked={label === l} onClick={() => setLabel(l)} className="chip">
            <LabelIcon label={l} />
            {t(l)}
          </button>
        ))}
      </div>
      {clash && <p className="mb-4 text-sm text-kumkum">{label === "home" ? t("homeTaken") : t("workTaken")}</p>}
      <AddressPicker value={addr} onChange={setAddr} center={center} />
      <div className="mt-6 flex gap-3">
        <button className="btn" disabled={!addr || clash || busy || addr.line.trim().length < 3} onClick={save}>
          {t("save")}
        </button>
        <button className="btn btn-ghost" onClick={onDone}>{t("cancel")}</button>
      </div>
    </div>
  );
}

function PaymentPref({ profile }: { profile: Profile }) {
  const t = useTranslations();
  const sb = supabaseBrowser()!;
  const [value, setValue] = useState<PaymentMode | null>(profile.preferred_payment);
  const { saved, flash } = useSavedFlash();
  const choose = async (v: PaymentMode | null) => {
    setValue(v);
    const { error } = await sb.from("profiles").update({ preferred_payment: v }).eq("id", profile.id);
    if (!error) flash();
  };
  const options: [PaymentMode | null, string][] = [
    ["upi_online", t("pay.upi_online")],
    ["upi_on_delivery", `${t("pay.upi_on_delivery")} / ${t("pay.upi_on_pickup")}`],
    ["cash", `${t("pay.cash_on_delivery")} / ${t("pay.cash_on_pickup")}`],
    [null, t("account.payNone")],
  ];
  return (
    <Block id="payments" title={t("account.payTitle")} sub={t("account.paySub")}>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
        {options.map(([v, label]) => (
          <button
            key={String(v)}
            role="radio"
            aria-checked={value === v}
            onClick={() => choose(v)}
            className={`relative rounded-[18px] p-4 text-left transition-[box-shadow,background-color] ${value === v ? "bg-turmeric shadow-[inset_0_0_0_2px_var(--ink)]" : "shadow-[inset_0_0_0_1px_var(--rule)] hover:shadow-[inset_0_0_0_1px_var(--ink)]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-3 h-6">
        <SavedTick show={saved} />
      </div>
    </Block>
  );
}

function WhatsAppPref({ profile }: { profile: Profile }) {
  const t = useTranslations("account");
  const sb = supabaseBrowser()!;
  const [on, setOn] = useState(profile.whatsapp_updates);
  const { saved, flash } = useSavedFlash();
  const toggle = async () => {
    const next = !on;
    setOn(next);
    const { error } = await sb.from("profiles").update({ whatsapp_updates: next }).eq("id", profile.id);
    if (error) setOn(!next);
    else flash();
  };
  return (
    <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-rule pt-6">
      <button role="switch" aria-checked={on} onClick={toggle} className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? "bg-[#25D366]" : "bg-paper-3"}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-paper shadow transition-[left] ${on ? "left-7" : "left-1"}`} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t("waTitle")}</p>
        <p className="text-sm text-ink-soft">{t("waSub")}</p>
      </div>
      <SavedTick show={saved} />
    </div>
  );
}

/** Change the mobile number: new number → 6-digit code emailed to the account → saved. */
function ChangePhone({ current }: { current: string | null }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [phone, setPhone] = useState(current);
  const [step, setStep] = useState<"view" | "number" | "code">("view");
  const [next, setNext] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pretty = (p: string | null) => (p ? `+91 ${p.slice(-10, -5)} ${p.slice(-5)}` : "—");
  const tm = useTranslations("mobile");
  const say = (j: { error?: string; reason?: string; left?: number }) =>
    setError(
      j.reason && tm.has(`err.${j.reason}`)
        ? tm(`err.${j.reason}`)
        : t.has(`phoneErr.${j.error}`)
          ? t(`phoneErr.${j.error}`, { left: j.left ?? 0 })
          : t("phoneErr.generic"),
    );

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profile/phone/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: next }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return say(j);
    setSentTo(j.sentTo);
    setCode("");
    setStep("code");
  };
  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profile/phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: next, code }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return say(j);
    setPhone(j.phone);
    setStep("view");
    router.refresh();
  };

  return (
    <div className="mt-10 rounded-[22px] bg-paper-2/60 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label">{t("mobile")}</p>
          <p className="lnum text-xl">{pretty(phone)}</p>
        </div>
        {step === "view" && (
          <button className="btn btn-ghost" onClick={() => (setNext(""), setError(null), setStep("number"))}>
            {t("changeMobile")}
          </button>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {step === "number" && (
          <motion.form key="n" onSubmit={requestCode} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <p className="mt-5 text-sm text-ink-soft">{t("changeMobileSub")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="min-w-64 flex-1">
                <MobileInput id="new-mobile" value={next} onChange={setNext} autoFocus />
              </div>
              <button className="btn self-start" disabled={!mobileOk(next) || busy}>{busy ? "…" : t("sendCode")}</button>
              <button type="button" className="btn btn-ghost self-start" onClick={() => setStep("view")}>{t("cancel")}</button>
            </div>
          </motion.form>
        )}
        {step === "code" && (
          <motion.form key="c" onSubmit={confirm} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <p className="mt-5 text-sm text-ink-soft">{t("codeSent", { email: sentTo })}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input className="field lnum !w-44 text-center text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} aria-label={t("code6")} autoFocus />
              <button className="btn" disabled={code.length !== 6 || busy}>{busy ? "…" : t("confirmMobile")}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setStep("number")}>{t("back")}</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      {error && <p role="alert" className="mt-3 text-sm text-kumkum">{error}</p>}
    </div>
  );
}

/** Which ways this account can sign in; every code goes to the same email. */
function LoginMethods({ methods, email }: { methods: LoginMethod[]; email: string | null }) {
  const t = useTranslations("account");
  const google = methods.some((m) => m.provider === "google");
  return (
    <div className="mt-8 rounded-[22px] bg-paper-2/60 p-5 md:p-6">
      <p className="label">{t("waysTitle")}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {google && (
          <li className="chip !cursor-default">
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Google
          </li>
        )}
        <li className="chip !cursor-default">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
            <path d="M3 6h18v12H3zM3 7l9 6 9-6" />
          </svg>
          {t("waysEmail")}
        </li>
      </ul>
      <p className="mt-3 text-sm text-ink-soft">{t("waysNote", { email: email ?? "" })}</p>
    </div>
  );
}
