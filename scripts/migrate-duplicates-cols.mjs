// Add missing columns to duplicates table to match leads schema.
import { config } from "dotenv";
import pg from "pg";
config({ path: ".env.local" });

const { POSTGRES_URL_NON_POOLING } = process.env;
if (!POSTGRES_URL_NON_POOLING) { console.error("Missing env"); process.exit(1); }

const ALTER = `
alter table public.duplicates
  add column if not exists rating numeric,
  add column if not exists reviews integer,
  add column if not exists linkedin_url text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists google_maps_url text;

-- ask PostgREST to reload schema cache
notify pgrst, 'reload schema';
`;

const c = new pg.Client({ connectionString: POSTGRES_URL_NON_POOLING, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  await c.query(ALTER);
  console.log("✓ duplicates columns added + schema cache reload notified");
} finally { await c.end(); }
