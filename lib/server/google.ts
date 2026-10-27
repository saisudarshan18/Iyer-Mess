import "server-only";

type LatLng = { lat: number; lng: number };

/** Road distance in km via the Routes API, or null when no server key is configured. */
export async function roadDistanceKm(origin: LatLng, dest: LatLng): Promise<number | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) return null;
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
      travelMode: "DRIVE",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Routes API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { routes?: { distanceMeters?: number }[] };
  const m = json.routes?.[0]?.distanceMeters;
  if (m === undefined) throw new Error("NO_ROUTE");
  return m / 1000;
}

export type ReverseGeocode = { state: string | null; district: string | null; pincode: string | null; formatted: string | null };

/** State / district / PIN for a point, so courier orders can be limited to one state. */
export async function reverseGeocode(p: LatLng): Promise<ReverseGeocode | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${p.lat},${p.lng}&key=${key}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Geocoding API ${res.status}`);
  const json = (await res.json()) as {
    results?: { formatted_address: string; address_components: { long_name: string; types: string[] }[] }[];
  };
  const first = json.results?.[0];
  if (!first) return { state: null, district: null, pincode: null, formatted: null };
  const find = (type: string) => json.results!.flatMap((r) => r.address_components).find((c) => c.types.includes(type))?.long_name ?? null;
  return {
    state: find("administrative_area_level_1"),
    district: find("administrative_area_level_3") ?? find("administrative_area_level_2"),
    pincode: find("postal_code"),
    formatted: first.formatted_address,
  };
}
