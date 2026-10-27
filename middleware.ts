import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_WS = SUPABASE.replace(/^https:/, "wss:");
const DEV = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy with a fresh nonce per request. Next.js reads the nonce from this
 * header and stamps it on its own scripts; 'strict-dynamic' then trusts what those scripts
 * load (Google Maps, Razorpay Checkout, Turnstile). Styles allow 'unsafe-inline' because the
 * animation libraries write inline style attributes.
 */
function csp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https:${DEV ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' data: blob: ${SUPABASE} https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com https://*.razorpay.com`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' ${SUPABASE} ${SUPABASE_WS} https://*.googleapis.com https://*.google.com https://*.gstatic.com https://*.razorpay.com https://challenges.cloudflare.com data: blob:`,
    "frame-src https://api.razorpay.com https://checkout.razorpay.com https://*.google.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    `media-src 'self' ${SUPABASE}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(DEV ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

// signed by their senders instead of carrying a browser Origin
const SERVER_TO_SERVER = ["/api/razorpay/webhook", "/api/auth/email-hook", "/api/whatsapp/webhook"];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // CSRF: browser writes to our API must come from our own pages
  if (path.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !SERVER_TO_SERVER.includes(path)) {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== req.headers.get("host")) {
      return NextResponse.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
    }
  }

  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const next = () => {
    const r = NextResponse.next({ request: { headers: requestHeaders } });
    r.headers.set("Content-Security-Policy", policy);
    return r;
  };
  let res = next();

  if (!SUPABASE || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return res;

  // keep the Supabase session cookie fresh
  const sb = createServerClient(SUPABASE, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = next();
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const {
    data: { user },
  } = await sb.auth.getUser();

  const needsLogin = ["/admin", "/checkout", "/orders", "/account"].some((p) => path.startsWith(p));
  if (needsLogin && !user) {
    const login = req.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(login);
  }
  // every account gives a mobile number (for delivery calls) before ordering or managing anything
  // admin: its layout already loads the profile (role + number), so skip the extra query here
  if (needsLogin && user && !path.startsWith("/admin")) {
    const { data: profile } = await sb.from("profiles").select("phone").eq("id", user.id).single();
    if (!profile?.phone) {
      const welcome = req.nextUrl.clone();
      welcome.pathname = "/welcome";
      welcome.search = `?next=${encodeURIComponent(path)}`;
      return NextResponse.redirect(welcome);
    }
  }
  return res;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|icon-512.png|manifest.webmanifest|.*opengraph-image.*|api/razorpay/webhook|api/auth/email-hook|api/whatsapp/webhook|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico)$).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
