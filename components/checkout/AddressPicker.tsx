"use client";

import { APIProvider, AdvancedMarker, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

export type PickedAddress = { line: string; landmark: string; lat: number; lng: number; place_id?: string };

/** Ask the browser for the device's GPS position (the customer must allow it). */
function useGps() {
  const t = useTranslations("gps");
  const [state, setState] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const locate = () =>
    new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!navigator.geolocation) {
        setState("error");
        setError(t("failed"));
        return resolve(null);
      }
      setState("locating");
      setError(null);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          setState("idle");
          resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
        },
        (e) => {
          setState("error");
          setError(e.code === e.PERMISSION_DENIED ? t("denied") : t("failed"));
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
      );
    });
  return { locate, locating: state === "locating", error };
}

function GpsButton({ onClick, locating }: { onClick: () => void; locating: boolean }) {
  const t = useTranslations("gps");
  return (
    <button type="button" onClick={onClick} disabled={locating} className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-leaf/10 px-4 text-sm font-medium text-leaf transition-colors hover:bg-leaf hover:text-paper disabled:opacity-60">
      <span className="relative grid h-5 w-5 place-items-center">
        {locating && <span className="absolute inset-0 animate-ping rounded-full bg-leaf/40" />}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="7.5" />
        </svg>
      </span>
      {locating ? t("locating") : t("use")}
    </button>
  );
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? "DEMO_MAP_ID";

/**
 * Places (New) autocomplete with our own dropdown, plus a draggable pin.
 * Without a Maps key it degrades to a typed address + "use my location".
 */
export function AddressPicker({
  value,
  onChange,
  center,
}: {
  value: PickedAddress | null;
  onChange: (a: PickedAddress) => void;
  center: { lat: number; lng: number } | null;
}) {
  if (!MAPS_KEY) return <FallbackPicker value={value} onChange={onChange} />;
  return (
    <APIProvider apiKey={MAPS_KEY} region="IN" language="en">
      <GooglePicker value={value} onChange={onChange} center={center} />
    </APIProvider>
  );
}

function GooglePicker({ value, onChange, center }: { value: PickedAddress | null; onChange: (a: PickedAddress) => void; center: { lat: number; lng: number } | null }) {
  const t = useTranslations("checkout");
  const places = useMapsLibrary("places");
  const geocoding = useMapsLibrary("geocoding");
  const [query, setQuery] = useState(value?.line ?? "");
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const landmark = value?.landmark ?? "";

  useEffect(() => {
    if (!places || query.trim().length < 3 || query === value?.line) {
      setSuggestions([]);
      return;
    }
    token.current ??= new places.AutocompleteSessionToken();
    const id = setTimeout(async () => {
      const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken: token.current!,
        includedRegionCodes: ["in"],
        ...(center ? { origin: center, locationBias: { center, radius: 50000 } } : {}),
      });
      setSuggestions(suggestions.filter((s) => s.placePrediction));
      setActive(-1);
    }, 220);
    return () => clearTimeout(id);
  }, [query, places, center, value?.line]);

  const choose = async (s: google.maps.places.AutocompleteSuggestion) => {
    const place = s.placePrediction!.toPlace();
    await place.fetchFields({ fields: ["location", "formattedAddress"] });
    token.current = null;
    setSuggestions([]);
    const line = place.formattedAddress ?? s.placePrediction!.text.text;
    setQuery(line);
    onChange({ line, landmark, lat: place.location!.lat(), lng: place.location!.lng(), place_id: place.id });
  };

  const gps = useGps();
  const useMyLocation = async () => {
    const p = await gps.locate();
    if (p) await onDrag(p.lat, p.lng);
  };

  const onDrag = async (lat: number, lng: number) => {
    let line = value?.line ?? "";
    if (geocoding) {
      const res = await new geocoding.Geocoder().geocode({ location: { lat, lng } });
      line = res.results[0]?.formatted_address ?? line;
      setQuery(line);
    }
    onChange({ line, landmark, lat, lng });
  };

  return (
    <div className="space-y-4">
      <div>
        <GpsButton onClick={useMyLocation} locating={gps.locating} />
        {gps.error && <p className="mt-2 text-sm text-kumkum">{gps.error}</p>}
      </div>
      <div className="relative">
        <label className="label" htmlFor="addr">
          {t("search")}
        </label>
        <input
          id="addr"
          className="field"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls="addr-list"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(suggestions.length - 1, a + 1));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
            else if (e.key === "Enter" && active >= 0) {
              e.preventDefault();
              choose(suggestions[active]);
            }
          }}
        />
        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.ul
              id="addr-list"
              role="listbox"
              data-lenis-prevent
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-auto rounded-2xl bg-paper p-2 shadow-[0_24px_48px_-20px_rgba(42,26,18,.45),inset_0_0_0_1px_var(--rule)]"
            >
              {suggestions.map((s, i) => (
                <li key={s.placePrediction!.placeId} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onClick={() => choose(s)}
                    className={`w-full rounded-xl px-3 py-2.5 text-left text-sm ${i === active ? "bg-paper-2" : "hover:bg-paper-2"}`}
                  >
                    <span className="block">{s.placePrediction!.mainText?.text}</span>
                    <span className="block text-xs text-ink-soft">{s.placePrediction!.secondaryText?.text}</span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {value && (
        <div className="overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_var(--rule)]">
          <div className="h-64" data-lenis-prevent>
            <Map mapId={MAP_ID} defaultCenter={{ lat: value.lat, lng: value.lng }} defaultZoom={16} gestureHandling="cooperative" disableDefaultUI clickableIcons={false}>
              <Recenter lat={value.lat} lng={value.lng} />
              <AdvancedMarker
                position={{ lat: value.lat, lng: value.lng }}
                draggable
                onDragEnd={(e) => e.latLng && onDrag(e.latLng.lat(), e.latLng.lng())}
              >
                <span className="block h-7 w-7 -translate-y-1 rounded-full rounded-bl-none border-2 border-paper bg-kumkum shadow-lg [transform:rotate(-45deg)]" />
              </AdvancedMarker>
            </Map>
          </div>
          <p className="bg-paper-2 px-4 py-2 text-xs text-ink-soft">{t("pin")}</p>
        </div>
      )}

      <div>
        <label className="label" htmlFor="landmark">
          {t("landmark")}
        </label>
        <input
          id="landmark"
          className="field"
          value={landmark}
          onChange={(e) => value && onChange({ ...value, landmark: e.target.value })}
          disabled={!value}
        />
      </div>
    </div>
  );
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map?.panTo({ lat, lng });
  }, [map, lat, lng]);
  return null;
}

function FallbackPicker({ value, onChange }: { value: PickedAddress | null; onChange: (a: PickedAddress) => void }) {
  const t = useTranslations("checkout");
  const [line, setLine] = useState(value?.line ?? "");
  const [landmark, setLandmark] = useState(value?.landmark ?? "");
  const gps = useGps();
  const locate = async () => {
    const p = await gps.locate();
    if (p) onChange({ line: line || "Current location", landmark, lat: p.lat, lng: p.lng });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="addr">
          {t("address")}
        </label>
        <textarea
          id="addr"
          className="field min-h-24"
          value={line}
          onChange={(e) => {
            setLine(e.target.value);
            if (value) onChange({ ...value, line: e.target.value });
          }}
        />
      </div>
      <div>
        <label className="label" htmlFor="landmark">
          {t("landmark")}
        </label>
        <input
          id="landmark"
          className="field"
          value={landmark}
          onChange={(e) => {
            setLandmark(e.target.value);
            if (value) onChange({ ...value, landmark: e.target.value });
          }}
        />
      </div>
      <GpsButton onClick={locate} locating={gps.locating} />
      {value && <p className="lnum text-xs text-ink-soft">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</p>}
      {gps.error && <p className="text-sm text-kumkum">{gps.error}</p>}
    </div>
  );
}
