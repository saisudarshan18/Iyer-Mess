import "server-only";
import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";

/** Client IP as seen by Vercel's edge (first hop of x-forwarded-for). */
export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Database-backed fixed-window limiter. Returns a 429 response when the caller is over the
 * limit, otherwise null. Fails open (logs) if the database is unreachable, so a Supabase
 * hiccup can't take ordering down.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<NextResponse | null> {
  try {
    const { data, error } = await supabaseService().rpc("rate_limit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
    if (error) throw error;
    if (data === false) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(windowSeconds) } });
    }
  } catch (e) {
    console.error("rate limit check failed", e);
  }
  return null;
}
