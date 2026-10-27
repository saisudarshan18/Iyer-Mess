"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Kolam } from "@/components/art/Kolam";
import { gsap, useGsap } from "@/components/motion/useGsap";
import { useStore } from "./StoreProvider";
import { TeamCodeCredit } from "./TeamCodeCredit";
import { directionsUrl, telUrl, whatsappUrl } from "@/lib/links";
import type { SocialKey } from "@/lib/types";

const SOCIAL: Record<SocialKey, { label: string; path: string }> = {
  instagram: { label: "Instagram", path: "M12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Zm0 7.6a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm5.9-7.8a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM21 8.3c-.1-1.5-.4-2.8-1.5-3.9S17.2 3 15.7 2.9c-1.5-.1-6-.1-7.5 0C6.8 3 5.5 3.3 4.4 4.4S3 6.8 2.9 8.3c-.1 1.5-.1 6 0 7.5.1 1.5.4 2.8 1.5 3.9s2.4 1.4 3.9 1.5c1.5.1 6 .1 7.5 0 1.5-.1 2.8-.4 3.9-1.5s1.4-2.4 1.5-3.9c.1-1.5.1-6 0-7.5Zm-2 9.1a3 3 0 0 1-1.7 1.7c-1.2.5-4 .4-5.3.4s-4.1.1-5.3-.4A3 3 0 0 1 5 17.4c-.5-1.2-.4-4-.4-5.3s-.1-4.1.4-5.3A3 3 0 0 1 6.7 5c1.2-.5 4-.4 5.3-.4s4.1-.1 5.3.4A3 3 0 0 1 19 6.7c.5 1.2.4 4 .4 5.3s.1 4.1-.4 5.4Z" },
  facebook: { label: "Facebook", path: "M14 13.5h2.5l1-4H14v-2c0-1 0-2 2-2h1.5V2.1A21 21 0 0 0 14.6 2C11.9 2 10 3.7 10 6.7v2.8H7v4h3V22h4v-8.5Z" },
  youtube: { label: "YouTube", path: "M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.8 15V9l5.7 3-5.7 3Z" },
  google: { label: "Google reviews", path: "M21.4 10.2h-9.2v3.7h5.3c-.5 2.4-2.6 3.7-5.3 3.7a5.6 5.6 0 0 1 0-11.2c1.4 0 2.6.5 3.6 1.3l2.7-2.7A9.5 9.5 0 1 0 12.2 21.5c4.8 0 9.2-3.5 9.2-9.5 0-.6-.1-1.2-.2-1.8Z" },
  x: { label: "X", path: "M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" },
};

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="kicker !text-paper/50">{title}</p>
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </div>
  );
}

export function Footer() {
  const t = useTranslations();
  const { settings } = useStore();
  const ref = useRef<HTMLElement>(null);
  const wa = whatsappUrl(settings.whatsapp_number ?? settings.shop_phone, t("contact.waText"));
  const socials = (Object.entries(settings.socials ?? {}) as [SocialKey, string][]).filter(([k, url]) => SOCIAL[k] && /^https:\/\//.test(url ?? ""));

  // the giant wordmark rises out of the floor as the footer arrives
  useGsap(ref, (mm, el) => {
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(el.querySelectorAll("[data-rise]"), {
        yPercent: 60,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom bottom", scrub: true },
      });
      gsap.to(el.querySelector("[data-spin]"), {
        rotate: 120,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom bottom", scrub: true },
      });
    });
  });

  return (
    <footer ref={ref} data-cursor-theme="dark" className="deckle-top relative overflow-hidden bg-ink pt-24 text-paper">
      <div data-spin className="pointer-events-none absolute -right-40 -top-40 w-[640px] text-turmeric/25">
        <Kolam size={640} lobes={12} strokeWidth={1.2} />
      </div>
      <div className="relative grid gap-12 px-[var(--gutter)] md:grid-cols-12">
        <div className="md:col-span-4">
          <p className="tamil text-4xl text-turmeric">{t("footer.bye")}</p>
          <p className="mt-3 max-w-sm text-paper/70">{t("footer.made")}</p>
          <p className="mt-6 flex items-center gap-2 text-sm">
            <span className="dot-live" data-closed={!settings.orders_open} />
            {settings.orders_open ? t("status.open") : t("status.closed")}
          </p>
          {socials.length > 0 && (
            <div className="mt-8">
              <p className="kicker !text-paper/50">{t("footer2.follow")}</p>
              <ul className="mt-3 flex gap-2">
                {socials.map(([key, url]) => (
                  <li key={key}>
                    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL[key].label} className="grid h-11 w-11 place-items-center rounded-full bg-paper/10 text-paper transition-[background-color,transform] duration-300 hover:-translate-y-1 hover:bg-turmeric hover:text-ink">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                        <path d={SOCIAL[key].path} />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="grid gap-10 text-sm sm:grid-cols-3 md:col-span-8">
          <FooterCol title={t("footer.visit")}>
            <p className="whitespace-pre-line text-paper/90">{settings.shop_address ?? "—"}</p>
            {settings.shop_lat !== null && settings.shop_lng !== null && (
              <a href={directionsUrl(settings.shop_lat, settings.shop_lng)} target="_blank" rel="noopener noreferrer" className="ink-link mt-3 inline-flex w-fit items-center gap-1.5 text-turmeric">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="m3 11 19-9-9 19-2-8-8-2Z" />
                </svg>
                {t("footer2.visit")}
              </a>
            )}
          </FooterCol>
          <FooterCol title={t("footer2.support")}>
            {settings.shop_phone && (
              <a className="ink-link w-fit" href={telUrl(settings.shop_phone)}>
                {t("footer.call")} · <span className="lnum">{settings.shop_phone}</span>
              </a>
            )}
            {wa && (
              <a className="ink-link w-fit" href={wa} target="_blank" rel="noopener noreferrer">
                {t("contact.whatsapp")}
              </a>
            )}
            {settings.support_email && (
              <a className="ink-link w-fit" href={`mailto:${settings.support_email}`}>
                {settings.support_email}
              </a>
            )}
            <Link href="/contact" className="ink-link w-fit">{t("footer2.contact")}</Link>
            <Link href="/orders" className="ink-link w-fit">{t("nav.orders")}</Link>
          </FooterCol>
          <FooterCol title={t("nav.menu")}>
            <Link href="/menu" className="ink-link w-fit">{t("nav.menu")}</Link>
            <Link href="/combos" className="ink-link w-fit">{t("nav.combos")}</Link>
            <Link href="/privacy" className="ink-link w-fit">{t("footer2.privacy")}</Link>
            <Link href="/terms" className="ink-link w-fit">{t("footer2.terms")}</Link>
            <Link href="/refunds" className="ink-link w-fit">{t("footer2.refunds")}</Link>
            <Link href="/shipping" className="ink-link w-fit">{t("footer2.shipping")}</Link>
          </FooterCol>
        </div>
      </div>
      <div className="relative mt-16 overflow-hidden pb-[0.24em] text-[clamp(4.5rem,19vw,19rem)]">
        <p data-rise className="display select-none whitespace-nowrap px-[var(--gutter)] !leading-[1.05] text-paper" aria-hidden>
          Iyer <span className="display-italic text-turmeric">Mess</span>
        </p>
      </div>
      <div
        className={`relative flex flex-col items-center justify-between gap-x-6 gap-y-3 border-t border-paper/15 px-[var(--gutter)] pt-6 text-xs text-paper/50 md:flex-row md:pr-28 ${settings.orders_open ? "pb-24 md:pb-8" : "pb-28"}`}
      >
        <span>© {new Date().getFullYear()} {settings.shop_name}</span>
        <TeamCodeCredit />
        <span className="tamil">ஐய்யர் மெஸ்</span>
      </div>
    </footer>
  );
}
