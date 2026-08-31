# Podcast Connect

**Find the right podcasts. Reach the right audiences. Start meaningful conversations.**

A podcast discovery and guest-matching platform. This build prioritizes the
two features you selected as most important: **search** and **match scoring**.
Those are complete and thoroughly tuned. The surrounding workflow (profiles,
saving, compare, a basic outreach pipeline) is built out enough to make the
search-and-match core usable end to end; the heavier outreach/analytics
modules from the full brief are intentionally scaffolded rather than finished
(see *Scope* below).

---

## What you can do right now

- **Search six ways** — describe what you want in plain language, search by
  subject, combine subjects, search by podcast name, by episode/topic text, by
  network/organization, or by target audience.
- **Combine subjects** and have the engine understand how they relate
  (e.g. *AI + relationships* surfaces the relationship show that ran an
  AI-and-dating episode).
- **See a 0–100 match score** for every podcast, each with a plain-language
  reason, flagged concerns, a suggested angle, and a per-dimension breakdown.
- **Filter** by reach, format, audience type, country, minimum match score,
  guest acceptance, and video availability.
- **Build a guest profile** that feeds your story into the scoring.
- **Save** podcasts, **compare** up to five side by side, and drop opportunities
  into a simple **outreach pipeline**.

Search works **without an account**. Saving, compare persistence, and the
pipeline require a free sign-in.

---

## Architecture

```
podcast-connect/
├── server/                 Node + Express API (port 4000)
│   ├── index.js            Routes: auth, profile, search, saved, campaigns, pipeline
│   ├── searchService.js    Query builder + natural-language parse + result shaping
│   ├── matchEngine.js      ★ The 0–100 match scorer (weighted dimensions)
│   ├── test-engine.js      Smoke test over the spec's example searches
│   └── db/
│       ├── schema.sql      Full relational schema (SQLite; Postgres-portable)
│       ├── seed.js         Demonstration podcasts, subjects, relation graph
│       └── index.js        DB bootstrap (auto-seeds on first run)
└── client/                 React + Vite single-page app
    └── src/
        ├── pages/          Discover ★, Compare, Profile, Auth, More (saved/pipeline/home)
        ├── components/     ResultCard, UI (match ring, artwork, tags)
        ├── api.js          Fetch client with JWT handling
        └── App.jsx         Shell, nav, shared state
```

### The match engine (the core)

`server/matchEngine.js` scores each (query/profile, podcast) pair by blending
seven independent 0–1 dimensions:

| Dimension  | Weight | What it measures |
|------------|:------:|------------------|
| Subject    | 0.30 | Topical overlap, including indirect matches through a subject-relation graph |
| Audience   | 0.22 | Overlap between who the show reaches and who you want to reach |
| Recency    | 0.12 | Whether recent episodes actually touch the topic |
| Geography  | 0.10 | Show reach vs. your geographic interest |
| Culture    | 0.09 | Cultural/community alignment |
| Openness   | 0.09 | Apparent openness to (new) guests |
| Story      | 0.08 | Strength and specificity of your proposed story |

A strong subject match lifts the composite so a clearly on-topic show doesn't
get buried by sparse optional fields; a near-zero subject match dampens it so
guest-openness alone can't inflate an off-topic show. No dimension invents
data — missing fields score neutral and surface as a *concern* instead of a
penalty.

Tune or inspect it with:

```bash
npm run test:engine
```

---

## Running it

Requires Node 22.5+ (the database uses the built-in `node:sqlite` module —
no native dependency to compile, which is also why it deploys cleanly to
serverless platforms like Netlify Functions).

```bash
# 1. Backend deps + first-run seed
npm install

# 2. Build the frontend
cd client && npm install && npm run build && cd ..

# 3. Start (serves API + built client on http://localhost:4000)
npm start
```

For frontend development with hot reload, run the API and Vite separately:

```bash
npm run dev            # API on :4000
npm run client:dev     # Vite on :5173, proxies /api to :4000
```

Reset the database (re-seeds demo data):

```bash
npm run seed:reset
```

Environment variables: `PORT` (default 4000), `JWT_SECRET` (set this in
production), `DB_PATH` (default `server/db/podcast_connect.db`).

---

## About the data

Every podcast in this build is **clearly labeled demonstration data**
(`is_demo = 1`, shown with a *Demo data* tag in the UI). The eight demo shows
were written to exercise the spec's example searches — single subject, combined
subjects, audience, cultural fit, geography, episode text, and network.

The schema and services are built to hold real, verified podcast records: each
podcast carries a `verification_source` and `last_verified_date`, and only
public contact fields are stored. Wiring in a real ingestion source (a podcast
index API or a vetted import) is the natural next step and does not require
changes to the match engine.

---

## Scope in this version

**Complete and prioritized**

- Search (all six modes) and the match-scoring engine, with explanations,
  concerns, angle, and per-dimension breakdown.
- Combined-subject understanding via the relation graph.
- Filters, guest profile, saved podcasts, compare, basic outreach pipeline.
- Accounts (JWT auth), guest/no-account search.

**Scaffolded, not finished** (present in the schema/brief, minimal or absent in
the UI so the core could be done well)

- Outreach message generation (pitch/DM/follow-up drafting) — the brief's
  "give hosts a reason to say yes" writing studio.
- Campaigns as a full workspace (the table and endpoints exist; no dedicated UI).
- Analytics/reporting beyond the simple dashboard counters.
- AI research assistant, calendar/scheduling, and integrations.

These were deferred deliberately, per the decision to prioritize search and
match scoring for the first version — not overlooked. Each has a clear seam in
the code to build against next.
