# Iyer Mess

Storefront, online ordering and shop console for Iyer Mess.
Built with Next.js 15, Supabase, Razorpay (UPI), Google Maps and Resend (email).
Smooth scrolling uses Lenis + GSAP ScrollTrigger.

```
npm install
npm run dev          # http://localhost:3000
```

The site runs without any keys. It shows the menu from `lib/catalog.ts`, but there's no stock, login or checkout until Supabase is connected.

## 1. Supabase

1. Create a project and copy the URL, anon key and service-role key into `.env.local`. Use `.env.example` as a template.
2. Put `DATABASE_URL` (Session pooler connection string) in `.env.local` and run `npm run db:apply`. Or, in the SQL editor, run `supabase/migrations/20261020000000_init.sql` and then `supabase/seed.sql`.
   Or use `supabase db push` with the Supabase CLI.
3. The migration turns on **pg_cron** (available on Supabase) and schedules a job every minute that releases stock held by unpaid UPI orders. Holds are also released before each new order.
4. **Login is by email code or Google**:
   - **Email**: Authentication → Providers → Email: on, "Confirm email" on, OTP length 6, expiry 600 s.
   - **Google**: Authentication → Providers → Google, using an OAuth client from Google Cloud with redirect URI `https://<project>.supabase.co/auth/v1/callback`.
   - **URL Configuration**: Site URL = your site; redirect URLs `https://<site>/auth/callback` and `http://localhost:3000/auth/callback`.
   - **Branded emails**: Authentication → Hooks → **Send Email hook** (HTTPS): `https://<site>/api/auth/email-hook`. Put its secret in `SUPABASE_EMAIL_HOOK_SECRET`; Supabase then hands every login email to the site, which sends it from info@svcloudkitchen.com via Resend.
   - After signing in, everyone adds a mobile number on `/welcome` (one account per number). Changing it later needs a code emailed to the account.
5. Give the owner access by email: log in once, then in the SQL editor run `select set_role('you@example.com', 'owner');`, or use `node scripts/link-owner-email.ts you@example.com` to attach an email to an existing owner account. After that, add staff by email in **Admin → Settings → Staff**.

## 2. First-time shop setup (Admin → Settings)

- **Shop**: address, phone and the map pin. Every delivery distance is measured from the pin.
- **Delivery**: only the slab you gave is seeded (0–5 km → ₹100). Add the rest, e.g. 5–7 km, then courier slabs beyond 7 km.
- **Time slots**: none are seeded. Takeaway and local delivery need at least one.
- **Products**: upload photos to replace the drawn illustrations.
- **Inventory**: enter opening stock in kg, and pack combo boxes if you pre-pack them.

## 3. Payments, maps, email

| Service | Env vars | Notes |
|---|---|---|
| Razorpay | `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Add a webhook at `/api/razorpay/webhook` with the events `payment.captured` and `order.paid`. Checkout is limited to UPI. |
| Google Maps | `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (Maps JS + Places New), `GOOGLE_MAPS_SERVER_KEY` (Routes + Geocoding) | Without the server key, distance is straight-line and courier orders are refused, because the state can't be verified. |
| WhatsApp (Meta Cloud API) | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_SHOP_TO` | Approved Utility templates `order_update` (to customers, who can switch it off on /account), `shop_new_order` and `shop_new_message` (to the shop). Webhook for delivery failures: `/api/whatsapp/webhook`. Nothing is sent until the keys are set. |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM`, `SHOP_NOTIFY_EMAIL`, `SUPABASE_EMAIL_HOOK_SECRET` | Verify `svcloudkitchen.com` in Resend. Sends login codes, mobile-change codes, order updates and contact messages from info@svcloudkitchen.com. Templates are in `lib/email/`. |

## Hosting

`vercel.json` pins the server functions to Tokyo (`hnd1`), next to the Supabase database (`ap-northeast-1`). Keep them in the same region, or every page pays a cross-ocean round trip per database call.

## How stock works

- Every change goes through Postgres functions in the migration. Nothing writes the stock tables directly.
  - `place_order`: online orders (server only) and walk-in orders (staff).
  - `cancel_order`, `adjust_stock` (add / remove / set) and `build_combo_boxes` (pack or unpack).
- Loose items are counted in grams. A combo sells from pre-packed boxes first. Once those run out, it is built from loose stock.
- Online UPI orders hold their stock for `hold_minutes` (default 15). If payment doesn't arrive, the stock goes back automatically.
- Every movement is logged in `stock_movements`, shown in Admin → Reports.

## Editing content

- Story text, process steps and all UI copy: `messages/en.json` and `messages/ta.json`.
- Shop photos for the story section: put them in `/public/story/` and list them in `lib/content.ts`.
- Menu seed: edit `lib/catalog.ts`, then run `npm run db:seed` to regenerate `supabase/seed.sql`. After launch, edit the menu in Admin instead.

## Customer features

- **Account** (`/account`, also in the avatar menu in the header):
  - name and email
  - saved Home / Work / Other addresses, with a default
  - preferred payment method, pre-selected at checkout
  - order notifications on/off
  - log out
- **GPS**: "Use my current location" fills the delivery pin (needs the customer's permission). On the admin orders board, **Directions** opens Google Maps navigation to that pin.
- **Push notifications** (web push, VAPID keys in env):
  - Customers get one at every status change.
  - Staff phones get one for every new online order and contact message.
  - Open tabs also play the shop chime; browsers don't allow custom sounds on the notification itself.
  - On iPhone, the site must first be added to the Home Screen (Apple's rule).
- **WhatsApp**:
  - a floating button
  - "ask about this order" on the order page
  - one-tap replies from Admin → Messages
- **Contact & support** (`/contact`): call, WhatsApp, email and hours, plus a message form. Messages go to Admin → Messages and to the support email.
- **Get directions** to the shop: on the homepage, the contact page and in the footer.
- **Privacy** (`/privacy`) and **Terms** (`/terms`): fill in the business details in Admin → Settings → Content.
- **"How a box is made"**: upload a photo or short video for each step in Admin → Settings → Content.

## Security

What the code does:
- **Content-Security-Policy** with a fresh nonce on every request (`middleware.ts`). Only our scripts, plus those they load (Google Maps, Razorpay, Turnstile), can run. The site can't be framed.
- **Headers** (`next.config.ts`): HSTS, nosniff, `X-Frame-Options: DENY`, strict referrer policy and Permissions-Policy. Logged-in pages are never cached.
- **CSRF**: every browser `POST` to `/api/*` must come from this site's own origin. The Razorpay webhook and the email hook are checked by their signatures instead.
- **Rate limits** (stored in the database, so they apply across all servers):
  - delivery quotes: 40 per 10 min per IP
  - orders: 8 per 10 min per account
  - slot lookups: 120 per minute
  - payment checks: 20 per 10 min
  - login codes: 5 per hour per email; mobile-change codes: 5 per hour per account (5 wrong tries locks a code)
- **Database**: row-level security on every table. All stock and price changes go through server functions, and prices are recalculated on the server.
- **Uploads**: product photos only, 5 MB max, and no SVG.

Dashboard settings to turn on:
- Supabase → Authentication → **Attack Protection**: CAPTCHA with Cloudflare Turnstile. Put the site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- Supabase → Authentication → **Rate Limits**: keep "Emails sent" modest, e.g. 30 per hour.
- Supabase → **Advisors → Security**: should report no errors.
- Rotate any key that has been shared in chat or email. Each service has a "roll"/"regenerate" button.

## Tests

```
npm test            # pricing + delivery rules (Vitest)
npm run test:sql    # migration + every stock path, in an in-process Postgres (PGlite)
npm run build && npx next start -p 3100 & npm run test:e2e   # storefront smoke tests (Playwright)
```
