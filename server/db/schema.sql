-- Podcast Connect — relational schema (SQLite; written to stay Postgres-portable:
-- plain INTEGER PKs instead of AUTOINCREMENT quirks, TEXT for JSON blobs, no
-- SQLite-only pragmas baked into the DDL itself).

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One guest profile per user; feeds the "story" scoring dimension.
CREATE TABLE IF NOT EXISTS guest_profiles (
  user_id               INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  professional_title    TEXT,
  personal_story        TEXT,
  expertise             TEXT,   -- JSON array of strings
  promoting             TEXT,   -- what they're promoting (book, business, etc.)
  previous_interviews   TEXT,   -- JSON array of strings/URLs
  target_subjects       TEXT,   -- JSON array — default subjects for their searches
  target_audiences      TEXT,   -- JSON array — default audiences for their searches
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Podcasts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS podcasts (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,
  description           TEXT,
  network               TEXT,               -- network/organization name
  format                TEXT,               -- interview | co_hosted | panel | solo | narrative
  interview_style       TEXT,               -- short label used in generated copy, e.g. "conversational"
  geo_reach             TEXT,               -- local | regional | national | international
  country               TEXT,
  state                 TEXT,
  city                  TEXT,
  location              TEXT,               -- free-text fallback for place matching
  cultural_focus        TEXT,
  audience_desc         TEXT,               -- short descriptor used in copy, e.g. "small business owners"
  reach_estimate         INTEGER,           -- approx downloads/listeners per episode
  accepts_guests        INTEGER NOT NULL DEFAULT 0,  -- 0/1
  guest_submission_url   TEXT,
  public_contact        TEXT,
  has_video              INTEGER NOT NULL DEFAULT 0,  -- 0/1
  artwork_url           TEXT,
  website_url           TEXT,
  is_demo                INTEGER NOT NULL DEFAULT 1,  -- 0/1 — demonstration data flag
  verification_source    TEXT,
  last_verified_date      TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subjects (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  slug  TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS podcast_subjects (
  podcast_id  INTEGER NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
  subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  is_primary  INTEGER NOT NULL DEFAULT 0,  -- 0/1
  PRIMARY KEY (podcast_id, subject_id)
);

-- Related-subject graph used for indirect subject matching. Directed edges;
-- searchService/matchEngine reads them into an in-memory adjacency map.
CREATE TABLE IF NOT EXISTS subject_relations (
  subject_slug  TEXT NOT NULL,
  related_slug  TEXT NOT NULL,
  weight        REAL NOT NULL DEFAULT 0.5,  -- 0..1 edge strength
  PRIMARY KEY (subject_slug, related_slug)
);

CREATE TABLE IF NOT EXISTS podcast_audiences (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  podcast_id  INTEGER NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
  audience    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS episodes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  podcast_id    INTEGER NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  published_at  TEXT
);

-- ---------------------------------------------------------------------------
-- User workflow: saved podcasts, outreach pipeline, campaigns (scaffolded)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS saved_podcasts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  podcast_id  INTEGER NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, podcast_id)
);

-- Full campaigns workspace is scaffolded (schema + endpoints) but has no
-- dedicated UI in this build — see README "Scope".
CREATE TABLE IF NOT EXISTS campaigns (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pipeline_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  podcast_id   INTEGER NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
  campaign_id  INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  stage        TEXT NOT NULL DEFAULT 'researching', -- researching | pitched | booked | declined
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, podcast_id)
);

CREATE INDEX IF NOT EXISTS idx_podcast_subjects_subject ON podcast_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_podcast_audiences_podcast ON podcast_audiences(podcast_id);
CREATE INDEX IF NOT EXISTS idx_episodes_podcast ON episodes(podcast_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_user ON pipeline_items(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_podcasts(user_id);
