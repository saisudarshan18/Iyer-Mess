import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export { normalisePhone } from "./validate";

export const MAX_CODE_ATTEMPTS = 5;
export const CODE_TTL_MS = 10 * 60 * 1000;

/** Six digits from a CSPRNG (never Math.random for codes). */
export const makeCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** Codes are stored only as an HMAC tied to the user and the requested number. */
export function hashCode(code: string, userId: string, phone: string, pepper: string) {
  return createHmac("sha256", pepper).update(`${userId}:${phone}:${code}`).digest("hex");
}

export type CodeRow = { code_hash: string; new_phone: string; attempts: number; expires_at: string; used_at: string | null };

/** Decide whether a submitted code unlocks the change. */
export function checkCode(row: CodeRow | null, code: string, userId: string, phone: string, pepper: string, now = Date.now()) {
  if (!row || row.used_at || row.new_phone !== phone) return { ok: false as const, reason: "NO_CODE" as const };
  if (new Date(row.expires_at).getTime() < now) return { ok: false as const, reason: "EXPIRED" as const };
  if (row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false as const, reason: "LOCKED" as const };
  const a = Buffer.from(hashCode(code.replace(/\D/g, ""), userId, phone, pepper));
  const b = Buffer.from(row.code_hash);
  if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true as const };
  return { ok: false as const, reason: "BAD_CODE" as const, left: MAX_CODE_ATTEMPTS - row.attempts - 1 };
}
