# Methodic Off-Market Tracker

Private acquisition lead tracking app for Methodic Ventures.
Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (auth + Postgres) · React Query.

## Features
- **Auth** — Supabase email/password, 4 fixed users (Gavin / Logan / Dean / Intern). Caller name auto-derived from email.
- **Dashboard** — pipeline funnel, calls/positive responses this week, hot leads, stalled leads, caller leaderboard.
- **Leads list** — filter by stage, tier, vet status, industry; quick filters: Uncalled · No Response · Positive Response · Active Pipeline · Dead · Vetted.
- **Lead detail** — inline-edit any field, click-to-call/mailto, full activity timeline.
- **Log Activity** — single modal: channel, person reached, outcome, duration, notes, optional stage advance. Auto-bumps `attempts_count` and `last_contact_at`.
- **Upload xlsx** — drag/drop, auto-map columns, dedupe preview, commit.
- **Duplicates** — review · delete · merge (fills blanks) · promote (false positive).

---

## Setup

### 1. Supabase
1. Create project at https://supabase.com → name it `methodic-tracker`.
2. **SQL Editor → New Query** → paste contents of `supabase_schema.sql` → Run.
3. **Authentication → Providers → Email** → toggle off "Confirm email".
4. **Authentication → Users → Add user** (4 times, **check Auto Confirm** for each):
   - `gavin@methodicventures.com` / `Acquireeverything$!`
   - `logan@methodicventures.com` / `Acquireeverything$!`
   - `dean@methodicventures.com` / `Acquireeverything$!`
   - `methodicpartners@gmail.com` / `methodicintern123!`
5. **Project Settings → API** — copy **Project URL** and **anon public key**.

### 2. Local env
```bash
cp .env.local.example .env.local
# Edit .env.local with your Project URL and anon key
```

### 3. Run
```bash
npm install
npm run dev
```
Open http://localhost:3000 → log in with one of the 4 emails.

---

## Deploy

### GitHub
```bash
# Install GitHub CLI: brew install gh
gh auth login
gh repo create methodic-tracker --private --source=. --push
```

Or manually: create a repo at https://github.com/new (private), then:
```bash
git remote add origin https://github.com/YOUR-USER/methodic-tracker.git
git branch -M main
git push -u origin main
```

### Vercel
1. Go to https://vercel.com/new → import the GitHub repo.
2. **Environment Variables** → add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy.

After deploy, also add the Vercel URL to **Supabase → Authentication → URL Configuration → Site URL** so auth redirects work.

---

## Project Structure
```
src/
├── app/
│   ├── (app)/                 # protected route group
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Dashboard
│   │   ├── leads/
│   │   ├── upload/
│   │   ├── duplicates/
│   │   └── settings/
│   ├── login/page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── nav/sidebar.tsx
│   ├── leads/
│   ├── ui/primitives.tsx
│   └── providers.tsx
├── lib/
│   ├── supabase/{client,server,middleware,types}.ts
│   ├── dedupe.ts
│   └── utils.ts
└── middleware.ts              # auth gate
```
