/**
 * Runs the real migration + seed in an in-process Postgres (PGlite) with
 * Supabase-like roles, then exercises every stock path.  `npm run test:sql`
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const root = new URL("../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");

const db = new PGlite();

// ── Supabase shims: roles, auth schema, storage, realtime publication ──
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, phone text, email text, raw_user_meta_data jsonb not null default '{}');
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create publication supabase_realtime;
`);

await db.exec(read("supabase/migrations/20261020000000_init.sql").replace("create extension if not exists pgcrypto;", ""));
await db.exec(read("supabase/migrations/20261021000000_pending_roles.sql"));
await db.exec(read("supabase/migrations/20261022000000_security.sql"));
await db.exec(read("supabase/migrations/20261023000000_account_push_content.sql"));
await db.exec(read("supabase/migrations/20261024000000_email_auth.sql"));
await db.exec(read("supabase/seed.sql"));
// seeds the offer box, so it runs after the products exist
await db.exec(read("supabase/migrations/20261025000000_courier_quotes_offers.sql"));

// On Supabase, API requests run with session_user = authenticator, so is_service()'s
// session_user check only matches pg_cron / the SQL editor. PGlite's session user is always
// postgres, so the harness marks "direct SQL" with a setting instead.
await db.exec(`
  create or replace function public.is_service() returns boolean language sql stable as $$
    select coalesce(auth.jwt() ->> 'role', '') = 'service_role' or current_setting('test.direct', true) = 'on' $$;
  select set_config('test.direct', 'on', false);
`);

// ── helpers ──
const OWNER = "11111111-1111-4111-8111-111111111111";
const STAFF = "22222222-2222-4222-8222-222222222222";
const CUST = "33333333-3333-4333-8333-333333333333";
// accounts sign in by email; the mobile number is added to the profile afterwards (by the server)
for (const [id, email, phone] of [[OWNER, "owner@test.in", "919000000001"], [STAFF, "staff@test.in", "919000000002"], [CUST, "cust@test.in", "919000000003"]]) {
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  await db.query("update profiles set phone = $2 where id = $1", [id, phone]);
}
await db.exec(`update profiles set role = 'owner' where id = '${OWNER}'; update profiles set role = 'staff' where id = '${STAFF}';`);

type Who = "owner" | "staff" | "customer" | "service" | "anon";
async function as<T = Record<string, unknown>>(who: Who, sql: string, params: unknown[] = []): Promise<T[]> {
  const role = who === "service" ? "service_role" : who === "anon" ? "anon" : "authenticated";
  const sub = { owner: OWNER, staff: STAFF, customer: CUST, service: "", anon: "" }[who];
  const claims = JSON.stringify({ sub, role });
  await db.exec(`select set_config('request.jwt.claims', '${claims}', false), set_config('test.direct', 'off', false); set role ${role};`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false), set_config('test.direct', 'on', false);`);
  }
}

const id = (slug: string) => `(select id from products where slug = '${slug}')`;
const stock = async (slug: string) => (await db.query<{ g: number }>(`select stock_g as g from inventory where product_id = ${id(slug)}`)).rows[0].g;
const boxed = async (slug: string) => (await db.query<{ b: number }>(`select boxed_stock as b from combos where slug = '${slug}'`)).rows[0].b;
const pid = async (slug: string) => (await db.query<{ id: string }>(`select id from products where slug = $1`, [slug])).rows[0].id;
const cid = async (slug: string) => (await db.query<{ id: string }>(`select id from combos where slug = $1`, [slug])).rows[0].id;

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n    ${(e as Error).message}`);
  }
}
function eq(actual: unknown, expected: unknown, what = "") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${what} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
async function rejects(p: Promise<unknown>, match: string) {
  try {
    await p;
  } catch (e) {
    if (!(e as Error).message.includes(match)) throw new Error(`expected error containing "${match}", got "${(e as Error).message}"`);
    return;
  }
  throw new Error(`expected error "${match}", but it succeeded`);
}
const order = (who: Who, p: object) => as<Record<string, string | number>>(who, "select * from place_order($1::jsonb)", [JSON.stringify(p)]).then((r) => r[0]);

console.log("\nstock functions");

await test("seed: 20 products, 3 combos + 1 offer, zero stock", async () => {
  eq((await db.query<{ n: number }>("select count(*)::int n from products")).rows[0].n, 20);
  eq((await db.query<{ n: number }>("select count(*)::int n from inventory where stock_g = 0")).rows[0].n, 20);
  eq((await db.query<{ n: number }>("select count(*)::int n from combo_items")).rows[0].n, 30);
  eq((await db.query<{ slug: string; price: string; offer_label: string }>("select slug, price, offer_label from combos where offer_label is not null")).rows, [{ slug: "offer-sweets-mixture", price: "250.00", offer_label: "Special offer" }]);
});

await test("staff restocks 5 kg of everything", async () => {
  for (const r of (await db.query<{ id: string }>("select id from products")).rows) {
    await as("staff", "select adjust_stock($1, null, 'add', 5000, 'opening stock')", [r.id]);
  }
  eq(await stock("laddu"), 5000);
  eq((await db.query<{ n: number }>("select count(*)::int n from stock_movements where reason = 'restock'")).rows[0].n, 20);
});

await test("customer cannot adjust stock or write inventory directly", async () => {
  await rejects(as("customer", "select adjust_stock($1, null, 'add', 100)", [await pid("laddu")]), "staff only");
  await as("customer", `update inventory set stock_g = 99999 where product_id = ${id("laddu")}`);
  eq(await stock("laddu"), 5000, "inventory");
});

await test("owner cannot bypass boxed_stock guard with a plain update", async () => {
  await rejects(as("owner", "update combos set boxed_stock = 50 where slug = 'combo-1'"), "adjust_stock");
});

let walkinId = "";
await test("walk-in sale deducts grams and is completed + paid", async () => {
  const o = await order("staff", {
    channel: "walkin",
    payment_mode: "cash",
    items: [{ type: "product", id: await pid("laddu"), grams: 500, qty: 2 }, { type: "product", id: await pid("mixer"), grams: 175, qty: 1 }],
  });
  walkinId = o.id as string;
  eq(o.status, "completed");
  eq(o.payment_status, "paid");
  eq(Number(o.total), 600 + 113.75, "total");
  eq(await stock("laddu"), 4000);
  eq(await stock("mixer"), 4825);
});

await test("customers cannot place walk-in orders; online orders need the server", async () => {
  await rejects(order("customer", { channel: "walkin", payment_mode: "cash", items: [{ type: "product", id: await pid("laddu"), grams: 250, qty: 1 }] }), "staff only");
  await rejects(order("customer", { channel: "online", fulfilment: "takeaway", payment_mode: "cash", items: [{ type: "product", id: await pid("laddu"), grams: 250, qty: 1 }] }), "website server");
});

await test("combo with no boxes is built from its components", async () => {
  const before = { b: await stock("badhusha"), l: await stock("legiyam"), g: await stock("ghee-mysore-pak") };
  const o = await order("staff", { channel: "walkin", payment_mode: "upi_counter", items: [{ type: "combo", id: await cid("combo-1"), qty: 1 }] });
  eq(Number(o.total), 650, "combo 1 total incl. packing");
  eq(await stock("badhusha"), before.b - 250);
  eq(await stock("legiyam"), before.l - 50);
  eq(await stock("ghee-mysore-pak"), before.g - 100);
});

await test("packing boxes moves component stock into boxed stock", async () => {
  const before = await stock("thenkuzhal");
  await as("staff", "select build_combo_boxes($1, 2)", [await cid("combo-1")]);
  eq(await boxed("combo-1"), 2);
  eq(await stock("thenkuzhal"), before - 500);
});

let mixedId = "";
await test("combo order takes boxes first, then builds the rest", async () => {
  const before = await stock("thenkuzhal");
  const o = await order("staff", { channel: "walkin", payment_mode: "cash", items: [{ type: "combo", id: await cid("combo-1"), qty: 3 }] });
  mixedId = o.id as string;
  eq(await boxed("combo-1"), 0);
  eq(await stock("thenkuzhal"), before - 250, "one box built");
  const f = (await db.query<{ f: { from_box: number; built: number } }>("select fulfilment f from order_items where order_id = $1", [mixedId])).rows[0].f;
  eq([f.from_box, f.built], [2, 1]);
});

await test("cancel puts back exactly what the order took (boxes and grams)", async () => {
  const before = await stock("thenkuzhal");
  await as("staff", "select cancel_order($1, 'test')", [mixedId]);
  eq(await boxed("combo-1"), 2);
  eq(await stock("thenkuzhal"), before + 250);
  // cancelling twice is a no-op
  await as("staff", "select cancel_order($1, 'again')", [mixedId]);
  eq(await boxed("combo-1"), 2);
});

await test("insufficient stock rolls back the whole order", async () => {
  const l = await stock("laddu");
  const m = await stock("mixer");
  await rejects(
    order("staff", { channel: "walkin", payment_mode: "cash", items: [{ type: "product", id: await pid("mixer"), grams: 250, qty: 1 }, { type: "product", id: await pid("laddu"), grams: 1000, qty: 50 }] }),
    "OUT_OF_STOCK:Laddu",
  );
  eq([await stock("laddu"), await stock("mixer")], [l, m]);
});

await test("online orders reject weights outside the pack sizes", async () => {
  await rejects(order("service", { channel: "online", fulfilment: "courier", payment_mode: "upi_online", items: [{ type: "product", id: await pid("laddu"), grams: 300, qty: 1 }] }), "BAD_WEIGHT");
});

await test("courier must be prepaid UPI", async () => {
  await rejects(order("service", { channel: "online", fulfilment: "courier", payment_mode: "cash", items: [{ type: "product", id: await pid("laddu"), grams: 250, qty: 1 }] }), "COURIER_PREPAID_ONLY");
});

let held = "";
await test("online UPI order holds stock as pending_payment", async () => {
  const before = await stock("jangiri");
  const o = await order("service", {
    channel: "online",
    fulfilment: "courier",
    user_id: CUST,
    payment_mode: "upi_online",
    delivery_fee: 250,
    items: [{ type: "product", id: await pid("jangiri"), grams: 500, qty: 1 }],
  });
  held = o.id as string;
  eq(o.status, "pending_payment");
  eq(Number(o.total), 325 + 250);
  eq(await stock("jangiri"), before - 500);
});

await test("customer sees own order, not others'", async () => {
  eq((await as("customer", "select id from orders")).length, 1);
  eq((await as("anon", "select id from orders")).length, 0);
});

await test("confirm_payment checks the Razorpay order id and is idempotent", async () => {
  await db.exec(`update orders set razorpay_order_id = 'order_TEST' where id = '${held}'`);
  await rejects(as("service", "select confirm_payment($1, 'order_OTHER', 'pay_1')", [held]), "MISMATCH");
  await rejects(as("customer", "select confirm_payment($1, 'order_TEST', 'pay_1')", [held]), "permission denied");
  await as("service", "select confirm_payment($1, 'order_TEST', 'pay_1')", [held]);
  await as("service", "select confirm_payment($1, 'order_TEST', 'pay_1')", [held]);
  const o = (await db.query<{ status: string; payment_status: string }>("select status, payment_status from orders where id = $1", [held])).rows[0];
  eq([o.status, o.payment_status], ["confirmed", "paid"]);
});

await test("expired payment holds release their stock", async () => {
  const before = await stock("thattai");
  const o = await order("service", { channel: "online", fulfilment: "courier", user_id: CUST, payment_mode: "upi_online", items: [{ type: "product", id: await pid("thattai"), grams: 1000, qty: 1 }] });
  eq(await stock("thattai"), before - 1000);
  await db.exec(`update orders set hold_expires_at = now() - interval '1 minute' where id = '${o.id}'`);
  const n = (await as<{ expire_holds: number }>("service", "select expire_holds()"))[0].expire_holds;
  eq(n, 1, "expired");
  eq(await stock("thattai"), before);
  eq((await db.query<{ status: string }>("select status from orders where id = $1", [o.id])).rows[0].status, "cancelled");
});

await test("late payment after expiry flags the order instead of confirming it", async () => {
  const o = await order("service", { channel: "online", fulfilment: "courier", user_id: CUST, payment_mode: "upi_online", items: [{ type: "product", id: await pid("omapodi"), grams: 250, qty: 1 }] });
  await db.exec(`update orders set razorpay_order_id = 'order_LATE', hold_expires_at = now() - interval '1 minute' where id = '${o.id}'`);
  await as("service", "select expire_holds()");
  await as("service", "select confirm_payment($1, 'order_LATE', 'pay_2')", [o.id]);
  const r = (await db.query<{ status: string; needs_attention: boolean; payment_status: string }>("select status, needs_attention, payment_status from orders where id = $1", [o.id])).rows[0];
  eq([r.status, r.payment_status, r.needs_attention], ["cancelled", "paid", true]);
});

await test("slot capacity is enforced for takeaway", async () => {
  await as("owner", "insert into time_slots (label, start_time, end_time, capacity) values ('Evening', '17:00', '19:00', 1)");
  const slot = (await db.query<{ id: string }>("select id from time_slots where label = 'Evening'")).rows[0].id;
  const date = (await db.query<{ d: string }>("select (current_date + 1)::text d")).rows[0].d;
  const p = { channel: "online", fulfilment: "takeaway", user_id: CUST, payment_mode: "cash", slot_id: slot, slot_date: date, items: [{ type: "product", id: await pid("somas"), grams: 250, qty: 1 }] };
  const first = await order("service", p);
  eq(first.status, "confirmed");
  eq(first.slot_label, "Evening");
  await rejects(order("service", p), "SLOT_FULL");
  const avail = await as<{ remaining: number }>("anon", "select remaining from slot_availability($1::date)", [date]);
  eq(avail[0].remaining, 0);
});

await test("takeaway and local delivery require a slot", async () => {
  await rejects(order("service", { channel: "online", fulfilment: "delivery_local", user_id: CUST, payment_mode: "cash", items: [{ type: "product", id: await pid("somas"), grams: 250, qty: 1 }] }), "SLOT_REQUIRED");
});

await test("closing orders blocks online but not walk-in", async () => {
  await as("staff", "select set_orders_open(false, 'Back Monday', null)");
  await rejects(order("service", { channel: "online", fulfilment: "courier", user_id: CUST, payment_mode: "upi_online", items: [{ type: "product", id: await pid("laddu"), grams: 250, qty: 1 }] }), "ORDERS_CLOSED");
  const o = await order("staff", { channel: "walkin", payment_mode: "cash", items: [{ type: "product", id: await pid("laddu"), grams: 250, qty: 1 }] });
  eq(o.status, "completed");
  eq((await db.query<{ m: string }>("select closed_message_en m from settings")).rows[0].m, "Back Monday");
  await as("staff", "select set_orders_open(true)");
  await rejects(as("customer", "select set_orders_open(false)"), "staff only");
});

await test("status changes: staff only, cancel via status restores stock", async () => {
  const before = await stock("ribbon");
  const o = await order("service", { channel: "online", fulfilment: "courier", user_id: CUST, payment_mode: "upi_online", items: [{ type: "product", id: await pid("ribbon"), grams: 500, qty: 1 }] });
  await rejects(as("staff", "select set_order_status($1, 'preparing')", [o.id]), "AWAITING_PAYMENT");
  await rejects(as("customer", "select set_order_status($1, 'cancelled')", [o.id]), "staff only");
  await as("staff", "select set_order_status($1, 'cancelled', 'customer called')", [o.id]);
  eq(await stock("ribbon"), before);
});

await test("set count / set_role / walk-in cancel round trip", async () => {
  await as("staff", "select adjust_stock(null, $1, 'set', 7, 'shelf count')", [await cid("combo-2")]);
  eq(await boxed("combo-2"), 7);
  await rejects(as("staff", "select set_role('cust@test.in', 'staff')"), "owner only");
  await as("owner", "select set_role(' Cust@Test.in ', 'staff')");
  eq((await db.query<{ role: string }>("select role from profiles where id = $1", [CUST])).rows[0].role, "staff");
  await as("owner", "select set_role('cust@test.in', 'customer')");
  await rejects(as("owner", "select set_role('not-an-email', 'staff')"), "BAD_EMAIL");
  const l = await stock("laddu");
  await as("staff", "select cancel_order($1)", [walkinId]);
  eq(await stock("laddu"), l + 1000);
});

await test("availability view reflects boxed + buildable", async () => {
  const r = (await db.query<{ boxed_stock: number; buildable: number }>("select boxed_stock, buildable from combo_availability where combo_id = $1", [await cid("combo-1")])).rows[0];
  eq(r.boxed_stock, 2);
  if (r.buildable < 1) throw new Error("expected buildable combos");
});

await test("pre-approved roles apply on first login, by email only", async () => {
  const NEW = "44444444-4444-4444-8444-444444444444";
  await as("owner", "select set_role('New.Staff@Test.in', 'staff')");
  await db.query("insert into auth.users (id, email) values ($1, 'new.staff@test.in')", [NEW]);
  eq((await db.query<{ role: string }>("select role from profiles where id = $1", [NEW])).rows[0].role, "staff");
  eq((await db.query<{ n: number }>("select count(*)::int n from pending_roles")).rows[0].n, 0);
  // a stranger typing the owner's phone number gets nothing
  const STRANGER = "55555555-5555-4555-8555-555555555555";
  await db.query("insert into auth.users (id, email, phone) values ($1, 'stranger@test.in', '917540050606')", [STRANGER]);
  eq((await db.query<{ role: string }>("select role from profiles where id = $1", [STRANGER])).rows[0].role, "customer");
  await rejects(as("staff", "select set_role('x@test.in', 'owner')"), "owner only");
});

await test("Google sign-up copies the name; email stays in step with the login", async () => {
  const G = "66666666-6666-4666-8666-666666666666";
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'Asha.G@Gmail.com', '{"full_name":"Asha G"}')`, [G]);
  eq((await db.query<{ name: string; email: string; phone: string | null }>("select name, email, phone from profiles where id = $1", [G])).rows[0], { name: "Asha G", email: "asha.g@gmail.com", phone: null });
  await db.query("update auth.users set email = 'asha@new.in' where id = $1", [G]);
  eq((await db.query<{ email: string }>("select email from profiles where id = $1", [G])).rows[0].email, "asha@new.in");
  await rejects(as("customer", "update profiles set email = 'hijack@x.in' where id = $1", [CUST]), "email can only change");
});

await test("one account per mobile number; change codes are server-only", async () => {
  const G = "66666666-6666-4666-8666-666666666666";
  await rejects(db.query("update profiles set phone = '91 90000 00003' where id = $1", [G]), "profiles_phone10_unique");
  await db.query("update profiles set phone = '919876500000' where id = $1", [G]);
  await db.query("insert into phone_change_codes (user_id, new_phone, code_hash) values ($1, '919876511111', 'h')", [CUST]);
  eq((await as("customer", "select * from phone_change_codes")).length, 0, "customers can't read codes");
  await rejects(db.query("insert into phone_change_codes (user_id, new_phone, code_hash) values ($1, '12345', 'h')", [CUST]), "check constraint");
});

await test("rate limiter allows max hits per window, server only", async () => {
  const hit = async () => (await as<{ rate_limit: boolean }>("service", "select rate_limit('t:1', 3, 60)"))[0].rate_limit;
  eq([await hit(), await hit(), await hit(), await hit()], [true, true, true, false]);
  await db.exec("update rate_limits set window_start = now() - interval '2 minutes' where key = 't:1'");
  eq(await hit(), true, "new window");
  await rejects(as("customer", "select rate_limit('t:2', 3, 60)"), "permission denied");
  eq((await as("customer", "select * from rate_limits")).length, 0, "customers can't read the table");
});

await test("product photo bucket accepts images up to 5 MB only", async () => {
  const b = (await db.query<{ file_size_limit: string; allowed_mime_types: string[] }>("select file_size_limit, allowed_mime_types from storage.buckets where id = 'products'")).rows[0];
  eq(Number(b.file_size_limit), 5242880);
  eq(b.allowed_mime_types.includes("image/webp") && !b.allowed_mime_types.includes("image/svg+xml"), true, "no SVG uploads");
});

await test("addresses: one Home and one Work each, any number of Other, private to the owner", async () => {
  const ins = (label: string) => as("customer", "insert into addresses (user_id, label, line, lat, lng) values ($1, $2, 'x street', 12.9, 79.1)", [CUST, label]);
  await ins("home");
  await ins("work");
  await ins("other");
  await ins("other");
  await rejects(ins("home"), "addresses_one_home_work");
  await rejects(ins("office"), "addresses_label_check");
  eq((await as("customer", "select id from addresses")).length, 4);
  eq((await as("staff", "select id from addresses")).length, 0, "staff can't read customer addresses");
  await rejects(as("staff", "insert into addresses (user_id, label, line, lat, lng) values ($1, 'other', 'y', 1, 1)", [CUST]), "row-level security");
});

await test("profile: customers edit name and preferences, never phone or role", async () => {
  await as("customer", "update profiles set name = 'Asha', preferred_payment = 'upi_online' where id = $1", [CUST]);
  eq((await db.query<{ name: string; preferred_payment: string }>("select name, preferred_payment from profiles where id = $1", [CUST])).rows[0], { name: "Asha", preferred_payment: "upi_online" });
  await rejects(as("customer", "update profiles set phone = '919999999999' where id = $1", [CUST]), "phone can only change");
  await rejects(as("customer", "update profiles set role = 'owner' where id = $1", [CUST]), "only the owner");
  await rejects(as("customer", "update profiles set preferred_payment = 'bitcoin' where id = $1", [CUST]), "check constraint");
});

await test("push subscriptions and contact messages are locked down", async () => {
  await db.query("insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/1', 'k', 'a')", [CUST]);
  eq((await as("customer", "select id from push_subscriptions")).length, 1);
  eq((await as("staff", "select id from push_subscriptions")).length, 0, "others can't see a device");
  await rejects(as("customer", "insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://evil', 'k', 'a')", [CUST]), "row-level security");
  await db.exec("insert into contact_messages (name, topic, message) values ('Ravi', 'bulk', 'Need 5 kg for a wedding')");
  eq((await as("customer", "select id from contact_messages")).length, 0, "customers can't read the inbox");
  eq((await as("staff", "select id from contact_messages")).length, 1);
  await rejects(as("anon", "insert into contact_messages (name, topic, message) values ('x', 'other', 'spam spam')"), "row-level security");
});

await test("courier quotes: written by the server only, read by the customer and staff", async () => {
  const items = JSON.stringify([{ type: "combo", id: await cid("offer-sweets-mixture"), qty: 1 }]);
  const insert = "insert into courier_requests (user_id, customer_name, customer_phone, items, address, weight_g, subtotal) values ($1, 'Ravi', '919000000003', $2::jsonb, '{\"line\":\"Salem\"}', 500, 250) returning short_code";
  await rejects(as("customer", insert, [CUST, items]), "row-level security");
  const [{ short_code }] = await as<{ short_code: string }>("service", insert, [CUST, items]);
  eq(short_code.startsWith("CQ"), true, "short code");
  eq((await as("customer", "select id from courier_requests")).length, 1);
  eq((await as("staff", "select id from courier_requests")).length, 1);
  eq((await as("anon", "select id from courier_requests")).length, 0);
  await as("customer", "update courier_requests set courier_fee = 0, status = 'quoted'");
  eq((await db.query<{ status: string }>("select status from courier_requests")).rows[0].status, "requested", "customers can't quote themselves");
  // stock is only taken when the customer pays: a courier order at the quoted fee
  const o = await order("service", { channel: "online", fulfilment: "courier", user_id: CUST, payment_mode: "upi_online", delivery_fee: 120, items: JSON.parse(items) });
  eq([o.status, Number(o.total)], ["pending_payment", 370]);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
