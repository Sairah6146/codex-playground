'use strict';

/**
 * Podcast Connect — Search Service
 * ---------------------------------
 * Loads podcasts (with their subjects/audiences/episodes) from SQLite,
 * turns a natural-language query into structured signals the match engine
 * understands, applies hard filters (name / network / episode text /
 * reach / format / country / guest acceptance / video), and scores +
 * ranks whatever remains with matchEngine.computeMatch.
 */

const { computeMatch, band } = require('./matchEngine');

const norm = (s) => (s || '').toLowerCase().trim();

// Keyword -> subject slug hints, used to pull subjects out of free text.
// Subject names themselves are also matched directly, so this only needs to
// cover the shorthand people actually type.
const SUBJECT_ALIASES = {
  'ai': 'artificial-intelligence',
  'artificial intelligence': 'artificial-intelligence',
  'machine learning': 'artificial-intelligence',
  'dating': 'relationships-dating',
  'relationships': 'relationships-dating',
  'love': 'relationships-dating',
  'wellness': 'health-and-wellness',
  'health': 'health-and-wellness',
  'finance': 'finance-and-investing',
  'investing': 'finance-and-investing',
  'money': 'finance-and-investing',
  'leadership': 'community-leadership',
  'community': 'community-leadership',
  'seniors': 'senior-citizens',
  'senior citizens': 'senior-citizens',
  'elderly': 'senior-citizens',
  'aging': 'senior-citizens',
  'black history': 'african-american-history',
  'african american': 'african-american-history',
  'african-american': 'african-american-history',
  'business': 'business-and-entrepreneurship',
  'entrepreneurship': 'business-and-entrepreneurship',
  'startups': 'technology-and-startups',
  'startup': 'technology-and-startups',
  'tech': 'technology-and-startups',
  'technology': 'technology-and-startups',
  'parenting': 'parenting-and-family',
  'family': 'parenting-and-family',
};

// Free-text audience hints -> the audience phrase used in podcast_audiences.
const AUDIENCE_HINTS = [
  ['startup founders', 'startup founders'],
  ['founders', 'startup founders'],
  ['entrepreneurs', 'entrepreneurs'],
  ['small business owners', 'small business owners'],
  ['business owners', 'business owners'],
  ['investors', 'investors'],
  ['financial advisors', 'financial advisors'],
  ['seniors', 'seniors'],
  ['caregivers', 'caregivers'],
  ['retirees', 'retirees'],
  ['parents', 'parents'],
  ['new parents', 'new parents'],
  ['families', 'families'],
  ['singles', 'singles'],
  ['newlyweds', 'newlyweds'],
  ['young professionals', 'young professionals'],
  ['community leaders', 'community leaders'],
  ['educators', 'educators'],
  ['history enthusiasts', 'history enthusiasts'],
  ['tech professionals', 'tech professionals'],
  ['engineers', 'engineers'],
  ['wellness seekers', 'wellness seekers'],
  ['health professionals', 'health professionals'],
];

const CULTURE_HINTS = [
  'african-american', 'african american', 'black',
  'latino', 'latina', 'hispanic',
  'asian american', 'asian-american',
  'lgbtq', 'indigenous', 'native american',
];

function getRelatedMap(db) {
  const rows = db.prepare('SELECT subject_slug, related_slug, weight FROM subject_relations').all();
  const map = {};
  for (const r of rows) {
    map[r.subject_slug] = map[r.subject_slug] || {};
    map[r.subject_slug][r.related_slug] = r.weight;
  }
  return map;
}

function getAllSubjects(db) {
  return db.prepare('SELECT id, slug, name FROM subjects ORDER BY name').all();
}

function getSearchContext(db) {
  const networks = db.prepare(
    'SELECT DISTINCT network FROM podcasts WHERE network IS NOT NULL'
  ).all().map((r) => r.network);
  const places = db.prepare(`
    SELECT DISTINCT city FROM podcasts WHERE city IS NOT NULL
    UNION SELECT DISTINCT state FROM podcasts WHERE state IS NOT NULL
    UNION SELECT DISTINCT country FROM podcasts WHERE country IS NOT NULL
  `).all().map((r) => Object.values(r)[0]).filter(Boolean);
  return { subjects: getAllSubjects(db), networks, places };
}

/**
 * Extracts structured search signals from a free-text query. Explicit
 * params passed alongside `q` always win; this only fills in gaps.
 */
function parseNaturalLanguage(rawQuery, ctx) {
  const q = norm(rawQuery);
  if (!q) return { subjects: [], audiences: [], geo: null, culture: null, network: null };

  const subjects = new Set();
  for (const subj of ctx.subjects) {
    if (q.includes(norm(subj.name))) subjects.add(subj.slug);
  }
  for (const [alias, slug] of Object.entries(SUBJECT_ALIASES)) {
    if (q.includes(alias)) subjects.add(slug);
  }

  const audiences = new Set();
  for (const [hint, phrase] of AUDIENCE_HINTS) {
    if (q.includes(hint)) audiences.add(phrase);
  }

  let geo = null;
  if (/\binternational\b|\bworldwide\b|\bglobal\b/.test(q)) geo = { reach: 'international' };
  else if (/\bnational\b|\bnationwide\b/.test(q)) geo = { reach: 'national' };
  else if (/\blocal\b|\bregional\b/.test(q)) geo = { reach: 'local' };
  for (const place of ctx.places) {
    if (place && q.includes(norm(place))) {
      geo = { reach: (geo && geo.reach) || 'local', place };
      break;
    }
  }

  let culture = null;
  for (const hint of CULTURE_HINTS) {
    if (q.includes(hint)) { culture = hint; break; }
  }

  let network = null;
  for (const n of ctx.networks) {
    if (n && q.includes(norm(n))) { network = n; break; }
  }

  return {
    subjects: [...subjects],
    audiences: [...audiences],
    geo,
    culture,
    network,
  };
}

function loadPodcastBundles(db) {
  const podcasts = db.prepare('SELECT * FROM podcasts').all();
  const subjectRows = db.prepare(`
    SELECT ps.podcast_id, s.slug, s.name, ps.is_primary
    FROM podcast_subjects ps JOIN subjects s ON s.id = ps.subject_id
  `).all();
  const audienceRows = db.prepare('SELECT podcast_id, audience FROM podcast_audiences').all();
  const episodeRows = db.prepare(
    'SELECT podcast_id, title, description, published_at FROM episodes ORDER BY published_at DESC'
  ).all();

  const subjectsByPodcast = new Map();
  for (const r of subjectRows) {
    if (!subjectsByPodcast.has(r.podcast_id)) subjectsByPodcast.set(r.podcast_id, []);
    subjectsByPodcast.get(r.podcast_id).push({ slug: r.slug, name: r.name, is_primary: !!r.is_primary });
  }
  const audiencesByPodcast = new Map();
  for (const r of audienceRows) {
    if (!audiencesByPodcast.has(r.podcast_id)) audiencesByPodcast.set(r.podcast_id, []);
    audiencesByPodcast.get(r.podcast_id).push(r.audience);
  }
  const episodesByPodcast = new Map();
  for (const r of episodeRows) {
    if (!episodesByPodcast.has(r.podcast_id)) episodesByPodcast.set(r.podcast_id, []);
    episodesByPodcast.get(r.podcast_id).push(r);
  }

  return podcasts.map((p) => ({
    ...p,
    accepts_guests: !!p.accepts_guests,
    has_video: !!p.has_video,
    is_demo: !!p.is_demo,
    subjects: subjectsByPodcast.get(p.id) || [],
    audiences: audiencesByPodcast.get(p.id) || [],
    episodes: episodesByPodcast.get(p.id) || [],
  }));
}

function shapeResult(bundle, match) {
  return {
    id: bundle.id,
    name: bundle.name,
    slug: bundle.slug,
    description: bundle.description,
    network: bundle.network,
    format: bundle.format,
    interview_style: bundle.interview_style,
    geo_reach: bundle.geo_reach,
    location: bundle.location,
    country: bundle.country,
    cultural_focus: bundle.cultural_focus,
    audience_desc: bundle.audience_desc,
    reach_estimate: bundle.reach_estimate,
    accepts_guests: bundle.accepts_guests,
    guest_submission_url: bundle.guest_submission_url,
    public_contact: bundle.public_contact,
    has_video: bundle.has_video,
    artwork_url: bundle.artwork_url,
    website_url: bundle.website_url,
    is_demo: bundle.is_demo,
    verification_source: bundle.verification_source,
    last_verified_date: bundle.last_verified_date,
    subjects: bundle.subjects.map((s) => s.name),
    audiences: bundle.audiences,
    score: match.score,
    band: band(match.score),
    reason: match.reason,
    concerns: match.concerns,
    angle: match.angle,
    breakdown: match.breakdown,
  };
}

/**
 * `params` — all optional:
 *   q             free text (parsed into subjects/audiences/geo/culture/network)
 *   subjects      string[] (explicit; merged with parsed)
 *   audiences     string[] (explicit; merged with parsed)
 *   name          podcast name search
 *   episodeText   free text matched against episode title/description
 *   network       network/organization name search
 *   geo           { reach, place }
 *   culture       string
 *   profile       guest profile object (feeds the "story" dimension)
 *   filters       { reach, format, audienceType, country, minScore, acceptsGuests, hasVideo }
 *   excludeDemo   when true, drops is_demo rows before scoring/filtering
 */
function search(db, params = {}) {
  const ctx = getSearchContext(db);
  const parsed = parseNaturalLanguage(params.q, ctx);

  const query = {
    subjects: (params.subjects && params.subjects.length ? params.subjects : parsed.subjects),
    audiences: (params.audiences && params.audiences.length ? params.audiences : parsed.audiences),
    geo: params.geo || parsed.geo,
    culture: params.culture || parsed.culture,
  };
  const network = params.network || parsed.network;
  const name = params.name || null;
  const episodeText = params.episodeText || null;
  const filters = params.filters || {};

  let bundles = loadPodcastBundles(db);

  if (params.excludeDemo) bundles = bundles.filter((p) => !p.is_demo);

  if (name) {
    const n = norm(name);
    bundles = bundles.filter((p) => norm(p.name).includes(n));
  }
  if (network) {
    const n = norm(network);
    bundles = bundles.filter((p) => norm(p.network).includes(n));
  }
  if (episodeText) {
    const t = norm(episodeText);
    bundles = bundles.filter((p) =>
      p.episodes.some((ep) => norm(`${ep.title} ${ep.description || ''}`).includes(t))
    );
  }
  if (filters.reach) bundles = bundles.filter((p) => p.geo_reach === filters.reach);
  if (filters.format) bundles = bundles.filter((p) => p.format === filters.format);
  if (filters.country) bundles = bundles.filter((p) => norm(p.country) === norm(filters.country));
  if (filters.audienceType) {
    const a = norm(filters.audienceType);
    bundles = bundles.filter((p) => p.audiences.some((x) => norm(x).includes(a)));
  }
  if (filters.acceptsGuests) bundles = bundles.filter((p) => p.accepts_guests);
  if (filters.hasVideo) bundles = bundles.filter((p) => p.has_video);

  const relatedMap = getRelatedMap(db);
  let results = bundles.map((bundle) => {
    const match = computeMatch({ query, profile: params.profile, podcast: bundle, relatedMap });
    return shapeResult(bundle, match);
  });

  if (filters.minScore != null) results = results.filter((r) => r.score >= Number(filters.minScore));

  results.sort((a, b) => b.score - a.score);

  return { results, parsed: { ...query, network }, count: results.length };
}

module.exports = { search, getSearchContext, getAllSubjects, getRelatedMap, loadPodcastBundles, shapeResult };
