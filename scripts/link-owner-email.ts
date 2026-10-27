// One-off: attach the owner's login email to the existing (phone-created) owner account,
// so it keeps its orders and role after the switch to email login.  node scripts/link-owner-email.ts <email>
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const email = (process.argv[2] ?? "").toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("usage: node scripts/link-owner-email.ts owner@example.com");

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: owners, error } = await sb.from("profiles").select("id, email, phone, name").eq("role", "owner");
if (error) throw error;
if (owners.length !== 1) throw new Error(`expected exactly one owner, found ${owners.length}`);
const owner = owners[0];
if (owner.email === email) {
  console.log("already linked:", email);
} else {
  const { error: e } = await sb.auth.admin.updateUserById(owner.id, { email, email_confirm: true });
  if (e) throw e;
  console.log(`linked ${email} to owner ${owner.name ?? owner.id} (phone ${owner.phone})`);
}
const { data: check } = await sb.from("profiles").select("email, phone, role").eq("id", owner.id).single();
console.log(check);
