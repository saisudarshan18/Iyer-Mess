/** wa.me link to an Indian number with a pre-filled message. */
export function whatsappUrl(phone: string | null | undefined, text = "") {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Google Maps turn-by-turn directions to a point (opens the app on phones). */
export function directionsUrl(lat: number, lng: number, mode: "driving" | "two-wheeler" | "walking" = "driving") {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${mode === "two-wheeler" ? "two-wheeler" : mode}`;
}

/** Google Maps place view for a point. */
export function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export const telUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "").replace(/^(\d{10})$/, "+91$1")}`;
