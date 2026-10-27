"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Settings, SocialKey } from "@/lib/types";
import { useToast } from "./AdminShell";

type Content = Pick<Settings, "whatsapp_number" | "support_email" | "support_hours" | "socials" | "legal" | "process_media">;
type Media = { type: "image" | "video"; url: string };

const SOCIALS: [SocialKey, string, string][] = [
  ["instagram", "Instagram", "https://instagram.com/…"],
  ["facebook", "Facebook", "https://facebook.com/…"],
  ["youtube", "YouTube", "https://youtube.com/@…"],
  ["google", "Google reviews / Business profile", "https://g.page/…"],
  ["x", "X (Twitter)", "https://x.com/…"],
];
const LEGAL: [keyof Settings["legal"], string, boolean?][] = [
  ["legal_name", "Business legal name (as registered)"],
  ["fssai", "FSSAI licence number"],
  ["grievance_name", "Grievance officer name"],
  ["grievance_email", "Grievance officer email"],
  ["jurisdiction", "City for legal jurisdiction (e.g. Vellore)"],
  ["refund_policy", "Cancellation & refund policy (shown on the Terms page)", true],
];
const STEPS = ["1 · Roast", "2 · Fry", "3 · Syrup", "4 · Pack"];

/** Owner-editable contact details, social links, legal details and process-step media. */
export function ContentTab() {
  const sb = supabaseBrowser()!;
  const toast = useToast();
  const [c, setC] = useState<Content | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    sb.from("settings")
      .select("whatsapp_number, support_email, support_hours, socials, legal, process_media")
      .eq("id", 1)
      .single()
      .then(({ data }) => setC(data as Content));
  }, [sb]);

  if (!c) return <div className="skeleton h-96" />;

  const save = async (patch: Partial<Content> = {}) => {
    const next = { ...c, ...patch };
    const bad = Object.values(next.socials ?? {}).find((u) => u && !/^https:\/\//.test(u));
    if (bad) return toast(`Social links must start with https:// (${bad})`, "err");
    setBusy(true);
    const { error } = await sb.from("settings").update({ ...next, updated_at: new Date().toISOString() }).eq("id", 1);
    setBusy(false);
    if (error) return toast(error.message, "err");
    setC(next);
    toast("Saved");
  };

  const upload = async (step: string, file: File) => {
    const type: Media["type"] | null = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;
    if (!type) return toast("Choose a photo (JPG, PNG, WebP) or a video (MP4, WebM)", "err");
    if (file.size > 50 * 1024 * 1024) return toast("Max 50 MB. Shorter or compressed videos load faster.", "err");
    setUploading(step);
    const path = `process/step-${step}-${Date.now()}.${file.name.split(".").pop()?.toLowerCase()}`;
    const { error } = await sb.storage.from("media").upload(path, file, { contentType: file.type, upsert: true });
    setUploading(null);
    if (error) return toast(error.message, "err");
    const url = sb.storage.from("media").getPublicUrl(path).data.publicUrl;
    await save({ process_media: { ...c.process_media, [step]: { type, url } } });
  };

  const field = (label: string, value: string, on: (v: string) => void, opts: { area?: boolean; placeholder?: string; type?: string } = {}) => (
    <label className="block">
      <span className="label">{label}</span>
      {opts.area ? (
        <textarea className="field min-h-28" value={value} placeholder={opts.placeholder} onChange={(e) => on(e.target.value)} />
      ) : (
        <input className="field" type={opts.type ?? "text"} value={value} placeholder={opts.placeholder} onChange={(e) => on(e.target.value)} />
      )}
    </label>
  );

  return (
    <div className="max-w-4xl space-y-12">
      <section>
        <h2 className="display text-3xl">Support & contact</h2>
        <p className="mb-4 text-sm text-ink-soft">Shown on the Contact page, the footer and the WhatsApp button. Contact-form messages are emailed to the support email.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {field("WhatsApp number", c.whatsapp_number ?? "", (v) => setC({ ...c, whatsapp_number: v.replace(/[^\d+]/g, "") || null }), { placeholder: "9952390089" })}
          {field("Support email", c.support_email ?? "", (v) => setC({ ...c, support_email: v || null }), { type: "email" })}
          {field("Support hours", c.support_hours ?? "", (v) => setC({ ...c, support_hours: v || null }), { placeholder: "Mon–Sat, 9 am – 8 pm" })}
        </div>
      </section>

      <section>
        <h2 className="display text-3xl">Social links</h2>
        <p className="mb-4 text-sm text-ink-soft">Leave blank to hide. Icons appear in the footer.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIALS.map(([k, label, ph]) => (
            <div key={k}>{field(label, c.socials?.[k] ?? "", (v) => setC({ ...c, socials: { ...c.socials, [k]: v.trim() || undefined } }), { placeholder: ph, type: "url" })}</div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="display text-3xl">Legal details</h2>
        <p className="mb-4 text-sm text-ink-soft">Fill these in before launch. Until then the Privacy and Terms pages show highlighted blanks.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {LEGAL.map(([k, label, area]) => (
            <div key={k} className={area ? "sm:col-span-2" : ""}>
              {field(label, c.legal?.[k] ?? "", (v) => setC({ ...c, legal: { ...c.legal, [k]: v || undefined } }), { area })}
            </div>
          ))}
        </div>
      </section>

      <button className="btn" disabled={busy} onClick={() => save()}>
        Save content
      </button>

      <section>
        <h2 className="display text-3xl">“How a box is made” photos & videos</h2>
        <p className="mb-4 text-sm text-ink-soft">One photo or short video per step (videos play muted on a loop). Up to 50 MB; under 10 MB loads faster.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {STEPS.map((label, i) => {
            const key = String(i + 1);
            const m = c.process_media?.[key as "1"];
            return (
              <div key={key} className="overflow-hidden rounded-[20px] bg-paper-2/60">
                <div className="relative aspect-[4/3] bg-paper-3">
                  {m?.type === "video" ? (
                    <video src={m.url} className="h-full w-full object-cover" muted loop autoPlay playsInline />
                  ) : m?.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-sm text-ink-mute">No photo or video yet</div>
                  )}
                  {uploading === key && <div className="absolute inset-0 grid place-items-center bg-paper/70 text-sm">Uploading…</div>}
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <span className="font-medium">{label}</span>
                  <span className="flex gap-2">
                    <label className="chip cursor-pointer !min-h-9 !text-xs">
                      {m ? "Replace" : "Upload"}
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(key, e.target.files[0])} />
                    </label>
                    {m && (
                      <button
                        className="chip !min-h-9 !text-xs text-kumkum"
                        onClick={() => {
                          const next = { ...c.process_media };
                          delete next[key as "1"];
                          save({ process_media: next });
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
