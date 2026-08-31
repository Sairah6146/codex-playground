'use strict';

/**
 * Pulls real, verifiable podcasts into the catalog from Apple's public
 * Podcasts directory (no API key required) plus each show's own RSS feed
 * for recent episodes. Inserted rows are flagged is_demo = 0 and carry a
 * real verification_source/last_verified_date — see README > About the
 * data. Deliberately does not invent fields the source doesn't provide
 * (geography, audience, culture, guest-openness): matchEngine already
 * treats missing data as neutral rather than penalizing it, so a thin
 * real record is honest, not broken.
 */

const { XMLParser } = require('fast-xml-parser');
const { safeFetch } = require('./lib/safeFetch');
const { insertPodcastRecords } = require('./db/podcastStore');

const APPLE_SEARCH_URL = 'https://itunes.apple.com/search';
const MAX_RESULTS = 10;
const MAX_EPISODES_PER_SHOW = 5;

// Conservative genre -> subject mapping: only mapped where an iTunes
// genre corresponds cleanly to one of our subjects. Anything else is left
// untagged rather than guessed — an untagged subject scores neutral, a
// wrong one actively misleads a search.
const GENRE_TO_SUBJECT = {
  'technology': 'technology-and-startups',
  'business': 'business-and-entrepreneurship',
  'entrepreneurship': 'business-and-entrepreneurship',
  'investing': 'finance-and-investing',
  'health & fitness': 'health-and-wellness',
  'alternative health': 'health-and-wellness',
  'mental health': 'health-and-wellness',
  'nutrition': 'health-and-wellness',
  'fitness': 'health-and-wellness',
  'parenting': 'parenting-and-family',
  'kids & family': 'parenting-and-family',
  'relationships': 'relationships-dating',
};

const norm = (s) => (s || '').toLowerCase().trim();
const slugify = (s) =>
  (s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Real-world feeds often embed raw (unescaped) HTML inside a title or
// description; fast-xml-parser then parses that element as an object of
// mixed content (e.g. { b: 'great', '#text': '...' }) rather than a plain
// string. toText flattens any such shape to plain text before stripHtml
// removes the tag markup itself.
function toText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(toText).join(' ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([k]) => !k.startsWith('@_'))
      .map(([, v]) => toText(v))
      .join(' ');
  }
  return String(value);
}
const stripHtml = (v) => toText(v).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function subjectsForGenres(genres = []) {
  const matched = [];
  for (const g of genres) {
    const slug = GENRE_TO_SUBJECT[norm(g)];
    if (slug && !matched.includes(slug)) matched.push(slug);
  }
  return matched.map((slug, i) => [slug, i === 0]);
}

async function searchApplePodcasts(term, limit) {
  const url = `${APPLE_SEARCH_URL}?media=podcast&entity=podcast&limit=${limit}&term=${encodeURIComponent(term)}`;
  const res = await safeFetch(url);
  if (!res.ok) throw new Error(`Apple Podcasts search failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

async function fetchFeed(feedUrl) {
  const res = await safeFetch(feedUrl, { headers: { 'user-agent': 'PodcastConnect/1.0' } });
  if (!res.ok) throw new Error(`Feed fetch failed (${res.status})`);
  const xml = await res.text();
  const parsed = xmlParser.parse(xml);
  const channel = parsed?.rss?.channel;
  if (!channel) throw new Error('Feed is missing an RSS <channel>');

  const rawItems = channel.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const episodes = items.slice(0, MAX_EPISODES_PER_SHOW).map((item) => {
    const published = item.pubDate ? new Date(item.pubDate) : null;
    return {
      title: stripHtml(item.title) || 'Untitled episode',
      description: stripHtml(item['itunes:summary'] || item.description).slice(0, 400),
      published_at: published && !Number.isNaN(published.getTime()) ? published.toISOString() : null,
    };
  });

  return {
    description: stripHtml(channel.description),
    websiteUrl: typeof channel.link === 'string' ? channel.link : null,
    episodes,
  };
}

/**
 * @param {object} db - the open node:sqlite database
 * @param {{ term: string, limit?: number }} params
 * @returns {Promise<{ imported: number, names: string[], skipped: { name: string, reason: string }[] }>}
 */
async function importPodcasts(db, { term, limit = 5 } = {}) {
  if (!term || !term.trim()) throw new Error('A search term is required.');
  const capped = Math.max(1, Math.min(MAX_RESULTS, Number(limit) || 5));

  const existingSlugs = new Set(db.prepare('SELECT slug FROM podcasts').all().map((r) => r.slug));

  const results = await searchApplePodcasts(term.trim(), capped);
  const records = [];
  const skipped = [];

  for (const r of results) {
    if (!r.feedUrl || !r.trackName) {
      skipped.push({ name: r.trackName || '(unnamed)', reason: 'missing name or feed URL' });
      continue;
    }

    let feed;
    try {
      feed = await fetchFeed(r.feedUrl);
    } catch (err) {
      skipped.push({ name: r.trackName, reason: `feed fetch failed: ${err.message}` });
      continue;
    }
    if (!feed.episodes.length) {
      skipped.push({ name: r.trackName, reason: 'feed had no usable episodes' });
      continue;
    }

    const baseSlug = slugify(r.trackName) || `podcast-${Date.now()}`;
    let slug = baseSlug;
    let n = 2;
    while (existingSlugs.has(slug)) slug = `${baseSlug}-${n++}`;
    existingSlugs.add(slug);

    records.push({
      slug,
      name: r.trackName,
      description: feed.description || `A podcast from ${r.artistName || 'an independent publisher'}.`,
      network: r.artistName || null,
      format: null,
      interview_style: null,
      geo_reach: null,
      country: null,
      state: null,
      city: null,
      location: null,
      cultural_focus: null,
      audience_desc: null,
      reach_estimate: null,
      accepts_guests: 0,
      guest_submission_url: null,
      public_contact: null,
      has_video: 0,
      artwork_url: r.artworkUrl600 || r.artworkUrl100 || null,
      website_url: feed.websiteUrl || r.collectionViewUrl || null,
      is_demo: 0,
      verification_source: 'Apple Podcasts Directory (imported)',
      last_verified_date: new Date().toISOString(),
      subjects: subjectsForGenres(r.genres),
      audiences: [],
      episodes: feed.episodes,
    });
  }

  const insertedIds = records.length ? insertPodcastRecords(db, records) : [];
  return { imported: insertedIds.length, names: records.map((r) => r.name), skipped };
}

module.exports = { importPodcasts };
