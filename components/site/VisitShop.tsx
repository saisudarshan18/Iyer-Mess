"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { Magnetic } from "@/components/motion/Magnetic";
import { haversineKm } from "@/lib/delivery";
import { directionsUrl, mapsUrl, telUrl, whatsappUrl } from "@/lib/links";
import { useStore } from "./StoreProvider";
import { WA_PATH } from "./WhatsAppButton";

/** Map of the shop with "Get directions" (opens Google Maps navigation) and quick contact. */
export function VisitShop({ id }: { id?: string }) {
  const t = useTranslations();
  const { settings } = useStore();
  const [km, setKm] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const has = settings.shop_lat !== null && settings.shop_lng !== null;
  const wa = whatsappUrl(settings.whatsapp_number ?? settings.shop_phone, t("contact.waText"));

  const howFar = () => {
    if (!has || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setKm(Math.round(haversineKm({ lat: p.coords.latitude, lng: p.coords.longitude }, { lat: settings.shop_lat!, lng: settings.shop_lng! }) * 10) / 10);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  return (
    <section id={id} className="px-[var(--gutter)] py-24 md:py-32">
      <div className="grid gap-10 md:grid-cols-12 md:items-center">
        <div className="md:col-span-5">
          <p className="folio">{t("footer2.visit")}</p>
          <h2 className="display mt-6 text-[clamp(2.8rem,6vw,5rem)]">{t("visit.title")}</h2>
          <p className="mt-3 text-lg text-ink-soft">{t("visit.sub")}</p>
          {settings.shop_address && <p className="mt-6 max-w-sm whitespace-pre-line leading-relaxed">{settings.shop_address}</p>}
          {settings.support_hours && <p className="mt-2 text-sm text-ink-soft">{settings.support_hours}</p>}

          <div className="mt-8 flex flex-wrap gap-3">
            {has ? (
              <>
                <Magnetic>
                  <a href={directionsUrl(settings.shop_lat!, settings.shop_lng!)} target="_blank" rel="noopener noreferrer" className="btn" data-cursor="Go">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="m3 11 19-9-9 19-2-8-8-2Z" />
                    </svg>
                    {t("visit.directions")}
                  </a>
                </Magnetic>
                <a href={mapsUrl(settings.shop_lat!, settings.shop_lng!)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                  {t("visit.openMaps")}
                </a>
              </>
            ) : (
              <p className="text-ink-soft">{t("visit.notSet")}</p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            {settings.shop_phone && (
              <a href={telUrl(settings.shop_phone)} className="ink-link">
                {t("contact.call")} · <span className="lnum">{settings.shop_phone}</span>
              </a>
            )}
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="ink-link inline-flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="#25D366" aria-hidden>
                  <path d={WA_PATH} />
                </svg>
                {t("contact.whatsapp")}
              </a>
            )}
            {has && (
              <button onClick={howFar} className="ink-link text-ink-soft" disabled={locating}>
                {locating ? t("gps.locating") : km !== null ? t("visit.fromYou", { km }) : t("visit.locate")}
              </button>
            )}
          </div>
        </div>

        <Reveal className="md:col-span-7">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[32px] bg-paper-2 shadow-[0_40px_80px_-40px_rgba(42,26,18,.5),inset_0_0_0_1px_var(--rule)]">
            {has ? (
              <>
                <iframe
                  title={t("visit.title")}
                  src={`https://maps.google.com/maps?q=${settings.shop_lat},${settings.shop_lng}&z=16&output=embed`}
                  className="absolute inset-0 h-full w-full grayscale-[35%] sepia-[25%]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                {/* a pin that drops in over the embed */}
                <motion.a
                  href={directionsUrl(settings.shop_lat!, settings.shop_lng!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ y: -40, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.4 }}
                  className="absolute bottom-5 left-5 flex items-center gap-3 rounded-2xl bg-paper/95 px-4 py-3 shadow-lg backdrop-blur"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-maroon text-paper">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    </svg>
                  </span>
                  <span className="text-sm">
                    <span className="block font-medium">{settings.shop_name}</span>
                    <span className="text-ink-soft">{t("visit.directions")} →</span>
                  </span>
                </motion.a>
              </>
            ) : (
              <div className="grid h-full place-items-center text-ink-soft">{t("visit.notSet")}</div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
