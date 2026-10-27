import { NextResponse } from "next/server";
import { z } from "zod";
import { quoteFor } from "@/lib/server/quote";
import { clientIp, rateLimit } from "@/lib/server/security";

const Body = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export async function POST(req: Request) {
  // each quote costs two Google API calls
  const limited = await rateLimit(`quote:${clientIp(req)}`, 40, 600);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { geo, ...quote } = await quoteFor(parsed.data);
    return NextResponse.json(quote);
  } catch (e) {
    console.error("quote failed", e);
    return NextResponse.json({ error: "QUOTE_FAILED" }, { status: 502 });
  }
}
