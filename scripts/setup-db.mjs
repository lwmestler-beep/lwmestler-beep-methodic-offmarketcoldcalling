// One-time setup: apply schema + create 4 users.
// Run from project root: node scripts/setup-db.mjs

import { readFileSync } from "node:fs";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const { POSTGRES_URL_NON_POOLING, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!POSTGRES_URL_NON_POOLING || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars. Run `vercel env pull .env.local` first.");
  process.exit(1);
}

const USERS = [
  { email: "gavin@methodicventures.com", password: "Acquireeverything$!" },
  { email: "logan@methodicventures.com", password: "Acquireeverything$!" },
  { email: "dean@methodicventures.com",  password: "Acquireeverything$!" },
  { email: "methodicpartners@gmail.com", password: "methodicintern123!" },
];

console.log("→ Applying SQL schema...");
const sql = readFileSync("./supabase_schema.sql", "utf-8");
const client = new pg.Client({
  connectionString: POSTGRES_URL_NON_POOLING,
  ssl: { rejectUnauthorized: false, requestCert: false },
  // bypass cert chain validation for managed connection
  // (Supabase managed pooler returns a self-signed cert in some envs)
});
await client.connect();
try {
  await client.query(sql);
  console.log("  ✓ schema applied");
} catch (e) {
  console.error("  ✗ schema error:", e.message);
  throw e;
} finally {
  await client.end();
}

console.log("→ Creating users via Supabase Admin API...");
for (const u of USERS) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: u.email,
      password: u.password,
      email_confirm: true,
    }),
  });
  if (res.ok) {
    console.log(`  ✓ created ${u.email}`);
  } else {
    const body = await res.json().catch(() => ({}));
    if (body.code === "email_exists" || body.message?.includes("already")) {
      console.log(`  · ${u.email} already exists`);
    } else {
      console.error(`  ✗ ${u.email}:`, body);
    }
  }
}

// Backfill profiles in case trigger didn't fire
console.log("→ Backfilling profiles...");
const c2 = new pg.Client({
  connectionString: POSTGRES_URL_NON_POOLING,
  ssl: { rejectUnauthorized: false, requestCert: false },
  // bypass cert chain validation for managed connection
  // (Supabase managed pooler returns a self-signed cert in some envs)
});
await c2.connect();
try {
  await c2.query(`
    insert into public.profiles (id, email, display_name)
    select id, email,
      case email
        when 'gavin@methodicventures.com' then 'Gavin'
        when 'logan@methodicventures.com' then 'Logan'
        when 'dean@methodicventures.com'  then 'Dean'
        when 'methodicpartners@gmail.com' then 'Intern'
        else split_part(email,'@',1)
      end
    from auth.users
    on conflict (id) do nothing;
  `);
  const { rows } = await c2.query("select email, display_name from public.profiles order by email");
  console.log("  ✓ profiles:");
  rows.forEach(r => console.log(`    ${r.display_name} (${r.email})`));
} finally {
  await c2.end();
}

console.log("\n✓ Done. Now run: vercel deploy --prod");
