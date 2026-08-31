'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const { getDb, persistDb } = require('./db');
const searchService = require('./searchService');
const { computeMatch, band } = require('./matchEngine');
const { hashPassword, comparePassword, signToken, requireAuth, optionalAuth } = require('./lib/auth');
const { importPodcasts } = require('./podcastImport');

const app = express();
const PORT = process.env.PORT || 4000;

// Route handlers below reference `db` as a plain synchronous DatabaseSync
// instance (unchanged from before persistence was added) — it's safe to do
// so because both the local app.listen() call and the Netlify function
// wrapper (netlify/functions/api.js) await `dbReady`/`app.ready` before any
// request actually reaches a route.
let db = null;
const dbReady = getDb().then((instance) => { db = instance; });

app.use(cors());
app.use(express.json());

// Persist to Netlify Blobs after any request that changed the database, so
// accounts/saves/pipeline/imported podcasts survive the next cold start.
// No-op outside a Netlify Function (see server/db/persist.js).
const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE']);
app.use((req, res, next) => {
  res.on('finish', () => {
    if (MUTATING_METHODS.has(req.method) && res.statusCode < 400) {
      persistDb().catch(() => {});
    }
  });
  next();
});

function asArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
}

function toBool(v) {
  return v === true || v === '1' || v === 'true';
}

function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name };
}

function getProfile(userId) {
  const row = db.prepare('SELECT * FROM guest_profiles WHERE user_id = ?').get(userId);
  if (!row) return null;
  return {
    professional_title: row.professional_title,
    personal_story: row.personal_story,
    expertise: row.expertise ? JSON.parse(row.expertise) : [],
    promoting: row.promoting,
    previous_interviews: row.previous_interviews ? JSON.parse(row.previous_interviews) : [],
    target_subjects: row.target_subjects ? JSON.parse(row.target_subjects) : [],
    target_audiences: row.target_audiences ? JSON.parse(row.target_audiences) : [],
    updated_at: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(norm(email));
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const info = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
    .run(norm(email), hashPassword(password), name || null);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(norm(email));
  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user), profile: getProfile(req.userId) });
});

function norm(s) { return String(s).toLowerCase().trim(); }

// ---------------------------------------------------------------------------
// Guest profile
// ---------------------------------------------------------------------------

app.get('/api/profile', requireAuth, (req, res) => {
  res.json({ profile: getProfile(req.userId) || {} });
});

app.put('/api/profile', requireAuth, (req, res) => {
  const b = req.body || {};
  db.prepare(`
    INSERT INTO guest_profiles (
      user_id, professional_title, personal_story, expertise, promoting,
      previous_interviews, target_subjects, target_audiences, updated_at
    ) VALUES (@user_id, @professional_title, @personal_story, @expertise, @promoting,
      @previous_interviews, @target_subjects, @target_audiences, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      professional_title = excluded.professional_title,
      personal_story = excluded.personal_story,
      expertise = excluded.expertise,
      promoting = excluded.promoting,
      previous_interviews = excluded.previous_interviews,
      target_subjects = excluded.target_subjects,
      target_audiences = excluded.target_audiences,
      updated_at = datetime('now')
  `).run({
    user_id: req.userId,
    professional_title: b.professional_title || null,
    personal_story: b.personal_story || null,
    expertise: JSON.stringify(asArray(b.expertise)),
    promoting: b.promoting || null,
    previous_interviews: JSON.stringify(asArray(b.previous_interviews)),
    target_subjects: JSON.stringify(asArray(b.target_subjects)),
    target_audiences: JSON.stringify(asArray(b.target_audiences)),
  });
  res.json({ profile: getProfile(req.userId) });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

app.get('/api/subjects', (req, res) => {
  res.json({ subjects: searchService.getAllSubjects(db) });
});

app.get('/api/search', optionalAuth, (req, res) => {
  const q = req.query;
  const profile = req.userId ? getProfile(req.userId) : null;

  const geo = (q.geoReach || q.geoPlace) ? { reach: q.geoReach || null, place: q.geoPlace || null } : null;

  const params = {
    q: q.q || null,
    subjects: asArray(q.subjects),
    audiences: asArray(q.audiences),
    name: q.name || null,
    episodeText: q.episodeText || null,
    network: q.network || null,
    geo,
    culture: q.culture || null,
    profile,
    excludeDemo: true,
    filters: {
      reach: q.reach || null,
      format: q.format || null,
      audienceType: q.audienceType || null,
      country: q.country || null,
      minScore: q.minScore != null && q.minScore !== '' ? Number(q.minScore) : null,
      acceptsGuests: toBool(q.acceptsGuests),
      hasVideo: toBool(q.hasVideo),
    },
  };

  res.json(searchService.search(db, params));
});

app.get('/api/podcasts/:id', optionalAuth, (req, res) => {
  const bundles = searchService.loadPodcastBundles(db);
  const bundle = bundles.find((p) => p.id === Number(req.params.id));
  if (!bundle) return res.status(404).json({ error: 'Podcast not found.' });

  const profile = req.userId ? getProfile(req.userId) : null;
  const relatedMap = searchService.getRelatedMap(db);
  const query = profile
    ? { subjects: profile.target_subjects, audiences: profile.target_audiences }
    : {};
  const match = computeMatch({ query, profile, podcast: bundle, relatedMap });
  res.json(searchService.shapeResult(bundle, match));
});

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

app.get('/api/compare', optionalAuth, (req, res) => {
  const ids = asArray(req.query.ids).map(Number).filter(Boolean).slice(0, 5);
  if (!ids.length) return res.json({ results: [] });

  const bundles = searchService.loadPodcastBundles(db).filter((p) => ids.includes(p.id));
  const profile = req.userId ? getProfile(req.userId) : null;
  const relatedMap = searchService.getRelatedMap(db);
  const query = profile
    ? { subjects: profile.target_subjects, audiences: profile.target_audiences }
    : {};

  const results = bundles.map((bundle) =>
    searchService.shapeResult(bundle, computeMatch({ query, profile, podcast: bundle, relatedMap }))
  );
  results.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  res.json({ results });
});

// ---------------------------------------------------------------------------
// Saved podcasts
// ---------------------------------------------------------------------------

app.get('/api/saved', requireAuth, (req, res) => {
  const ids = db.prepare('SELECT podcast_id FROM saved_podcasts WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.userId).map((r) => r.podcast_id);
  const bundles = searchService.loadPodcastBundles(db).filter((p) => ids.includes(p.id));
  const relatedMap = searchService.getRelatedMap(db);
  const profile = getProfile(req.userId);
  const query = profile ? { subjects: profile.target_subjects, audiences: profile.target_audiences } : {};
  const byId = new Map(bundles.map((b) => [b.id, b]));
  const results = ids.map((id) => byId.get(id)).filter(Boolean)
    .map((bundle) => searchService.shapeResult(bundle, computeMatch({ query, profile, podcast: bundle, relatedMap })));
  res.json({ results });
});

app.post('/api/saved', requireAuth, (req, res) => {
  const podcastId = Number(req.body?.podcastId);
  const podcast = db.prepare('SELECT id FROM podcasts WHERE id = ?').get(podcastId);
  if (!podcast) return res.status(404).json({ error: 'Podcast not found.' });
  db.prepare('INSERT OR IGNORE INTO saved_podcasts (user_id, podcast_id) VALUES (?, ?)').run(req.userId, podcastId);
  res.status(201).json({ ok: true });
});

app.delete('/api/saved/:podcastId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM saved_podcasts WHERE user_id = ? AND podcast_id = ?')
    .run(req.userId, Number(req.params.podcastId));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Outreach pipeline
// ---------------------------------------------------------------------------

const STAGES = new Set(['researching', 'pitched', 'booked', 'declined']);

app.get('/api/pipeline', requireAuth, (req, res) => {
  const items = db.prepare(`
    SELECT pi.*, p.name AS podcast_name, p.artwork_url, p.slug AS podcast_slug
    FROM pipeline_items pi JOIN podcasts p ON p.id = pi.podcast_id
    WHERE pi.user_id = ? ORDER BY pi.updated_at DESC
  `).all(req.userId);
  res.json({ items });
});

app.post('/api/pipeline', requireAuth, (req, res) => {
  const { podcastId, campaignId, stage, notes } = req.body || {};
  const podcast = db.prepare('SELECT id FROM podcasts WHERE id = ?').get(Number(podcastId));
  if (!podcast) return res.status(404).json({ error: 'Podcast not found.' });
  const finalStage = STAGES.has(stage) ? stage : 'researching';

  db.prepare(`
    INSERT INTO pipeline_items (user_id, podcast_id, campaign_id, stage, notes)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, podcast_id) DO UPDATE SET
      campaign_id = excluded.campaign_id, stage = excluded.stage, notes = excluded.notes,
      updated_at = datetime('now')
  `).run(req.userId, Number(podcastId), campaignId ? Number(campaignId) : null, finalStage, notes || null);

  res.status(201).json({ ok: true });
});

app.put('/api/pipeline/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM pipeline_items WHERE id = ? AND user_id = ?')
    .get(Number(req.params.id), req.userId);
  if (!item) return res.status(404).json({ error: 'Pipeline item not found.' });

  const stage = STAGES.has(req.body?.stage) ? req.body.stage : item.stage;
  const notes = req.body?.notes !== undefined ? req.body.notes : item.notes;
  db.prepare("UPDATE pipeline_items SET stage = ?, notes = ?, updated_at = datetime('now') WHERE id = ?")
    .run(stage, notes, item.id);
  res.json({ ok: true });
});

app.delete('/api/pipeline/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM pipeline_items WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.userId);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Campaigns (scaffolded — see README > Scope)
// ---------------------------------------------------------------------------

app.get('/api/campaigns', requireAuth, (req, res) => {
  const campaigns = db.prepare('SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json({ campaigns });
});

app.post('/api/campaigns', requireAuth, (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Campaign name is required.' });
  const info = db.prepare('INSERT INTO campaigns (user_id, name, description) VALUES (?, ?, ?)')
    .run(req.userId, name, description || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// ---------------------------------------------------------------------------
// Real-data ingestion (see README > About the data)
// ---------------------------------------------------------------------------

// Pulls real podcasts from Apple's public directory + their RSS feeds and
// adds them to the catalog (is_demo = 0). Gated behind requireAuth since it
// triggers outbound server-side fetches; safeFetch further guards those
// against SSRF (see server/lib/safeFetch.js).
app.post('/api/admin/import-podcasts', requireAuth, async (req, res) => {
  try {
    const result = await importPodcasts(db, req.body || {});
    res.status(201).json(result);
  } catch (err) {
    res.status(502).json({ error: err.message || 'Import failed.' });
  }
});

// ---------------------------------------------------------------------------
// Static client + health check
// ---------------------------------------------------------------------------

app.get('/api/health', (req, res) => res.json({ ok: true }));

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

if (require.main === module) {
  dbReady.then(() => {
    app.listen(PORT, () => {
      console.log(`Podcast Connect API listening on http://localhost:${PORT}`);
      if (!fs.existsSync(clientDist)) {
        console.log('Client build not found — run `npm run client:build` or `npm run client:dev` for the UI.');
      }
    });
  });
}

module.exports = app;
module.exports.ready = dbReady;
