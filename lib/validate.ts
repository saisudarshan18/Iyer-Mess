/**
 * Name and Indian-mobile checks, shared by the browser (live feedback) and the
 * server (the real gate). No SMS is sent, so this can't prove a number belongs to
 * someone; it rejects anything that isn't a valid mobile or looks made up.
 */

/** Any Indian mobile input ("+91 98765 43210", "09876543210", "9876543210") → "919876543210", or null. */
export function normalisePhone(input: string): string | null {
  const d = input.replace(/\D/g, "");
  const ten = d.length === 12 && d.startsWith("91") ? d.slice(2) : d.length === 11 && d.startsWith("0") ? d.slice(1) : d;
  return /^[6-9]\d{9}$/.test(ten) ? `91${ten}` : null;
}

export type MobileReason = "FORMAT" | "SAME_DIGITS" | "SEQUENCE" | "PATTERN" | "PLACEHOLDER";

const PLACEHOLDERS = new Set([
  "9876543210", "9123456789", "9012345678", "9988776655", "9876598765", "9000000001", "9999900000",
  "8888800000", "7777700000", "9898989898", "9090909090", "9191919191", "8080808080", "7070707070",
  "9999999998", "9999999990", "9876512345", "6789012345", "7890123456", "8901234567",
]);

/** Longest run of digits that go up (or down) by one, e.g. "45678" → 5. */
function longestRun(ten: string, dir: 1 | -1) {
  let best = 1, cur = 1;
  for (let i = 1; i < ten.length; i++) {
    cur = Number(ten[i]) - Number(ten[i - 1]) === dir ? cur + 1 : 1;
    best = Math.max(best, cur);
  }
  return best;
}

export function validateMobile(input: string): { ok: true; e164: string } | { ok: false; reason: MobileReason } {
  const e164 = normalisePhone(input);
  if (!e164) return { ok: false, reason: "FORMAT" };
  const ten = e164.slice(2);
  const counts = [...ten].reduce<Record<string, number>>((m, d) => ((m[d] = (m[d] ?? 0) + 1), m), {});
  if (Math.max(...Object.values(counts)) >= 7) return { ok: false, reason: "SAME_DIGITS" };
  if (PLACEHOLDERS.has(ten)) return { ok: false, reason: "PLACEHOLDER" };
  // a block of 1–3 digits repeated across the whole number (9898989898, 9879879879)
  for (const size of [1, 2, 3]) {
    const block = ten.slice(0, size);
    if (block.repeat(Math.ceil(10 / size)).slice(0, 10) === ten) return { ok: false, reason: "PATTERN" };
  }
  // two halves the same (98765 98765), or a 7+ long staircase (92345678.., 98765432..);
  // shorter runs like "012345" do turn up in real numbers
  if (ten.slice(0, 5) === ten.slice(5)) return { ok: false, reason: "PATTERN" };
  if (longestRun(ten, 1) >= 7 || longestRun(ten, -1) >= 7) return { ok: false, reason: "SEQUENCE" };
  return { ok: true, e164 };
}

export type NameReason = "SHORT" | "LONG" | "CHARS" | "FAKE";

/** A real-looking personal name: Tamil or English letters, spaces and . ' - only. */
export function validateName(input: string): { ok: true; clean: string } | { ok: false; reason: NameReason } {
  const clean = input.normalize("NFC").replace(/\s+/g, " ").trim();
  if (clean.length < 2) return { ok: false, reason: "SHORT" };
  if (clean.length > 60) return { ok: false, reason: "LONG" };
  if (/[\d@/\\:_#$%^&*+=<>{}[\]|~`!?,;"()]/.test(clean) || /https?|www\./i.test(clean)) return { ok: false, reason: "CHARS" };
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(clean)) return { ok: false, reason: "CHARS" };
  const letters = clean.match(/\p{L}/gu) ?? [];
  if (letters.length < 2) return { ok: false, reason: "SHORT" };
  // "aaaa", "xxxx xxxx": a name needs at least two different letters
  if (new Set(letters.map((l) => l.toLowerCase())).size < 2) return { ok: false, reason: "FAKE" };
  return { ok: true, clean };
}

/** "9876543210" (or partial) → "98765 43210", for the fixed +91 _____ _____ template. */
export function formatMobile(digits: string) {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
}
