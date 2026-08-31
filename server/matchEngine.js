'use strict';

/**
 * Podcast Connect — Match Scoring Engine
 * ---------------------------------------
 * Produces a 0–100 Podcast Match Score for a (query/profile, podcast) pair,
 * plus a human-readable reason, potential concerns, and a suggested angle.
 *
 * The score is a weighted blend of independent 0–1 dimension scores. Weights
 * are tuned so that subject and audience alignment dominate, with geography,
 * recency, guest-openness, and story strength as meaningful modifiers.
 *
 * No dimension invents data: when a field is absent the dimension returns a
 * neutral value and is noted as a gap rather than scored as a negative.
 */

const WEIGHTS = {
  subject:    0.30, // topical overlap incl. related-subject graph
  audience:   0.22, // who the show reaches vs. who the user wants
  recency:    0.12, // recent episodes on-topic
  geography:  0.10, // geo reach vs. user's geographic interest
  culture:    0.09, // cultural/community alignment
  openness:   0.09, // apparent openness to (new) guests
  story:      0.08, // strength/specificity of the user's proposed story
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const norm = (s) => (s || '').toLowerCase().trim();
const slug = (s) =>
  (s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null || v === '') return [];
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : [v]; }
  catch { return String(v).split(',').map((x) => x.trim()).filter(Boolean); }
}

/**
 * Subject alignment. Direct subject matches score full weight; matches through
 * the related-subject graph score their edge weight. `relatedMap` maps a
 * subject slug -> { relatedSlug: weight }.
 */
function scoreSubject(querySubjects, podcastSubjects, relatedMap) {
  const q = querySubjects.map(slug).filter(Boolean);
  if (!q.length) return { score: 0.5, matched: [], via: [] };

  const podSlugs = new Set(podcastSubjects.map((s) => s.slug || slug(s.name)));
  const podPrimary = new Set(
    podcastSubjects.filter((s) => s.is_primary).map((s) => s.slug || slug(s.name))
  );

  let best = 0;
  const matched = [];
  const via = [];

  for (const qs of q) {
    if (podPrimary.has(qs)) { best = Math.max(best, 1.0); matched.push(qs); continue; }
    if (podSlugs.has(qs))   { best = Math.max(best, 0.85); matched.push(qs); continue; }
    // indirect through the relation graph
    const rel = relatedMap[qs] || {};
    let localBest = 0;
    for (const [relSlug, w] of Object.entries(rel)) {
      if (podSlugs.has(relSlug)) { localBest = Math.max(localBest, 0.55 * w + 0.2); via.push(relSlug); }
    }
    best = Math.max(best, localBest);
  }

  // Reward covering MORE of a combined query, not just the single best hit.
  // Coverage is scaled by how strong the matches are, so a show that hits every
  // subject in the query outranks one that hits a single subject well.
  const uniqMatched = [...new Set(matched)];
  const coverage = uniqMatched.length / q.length;
  const score = clamp01(best * (0.6 + 0.4 * coverage));
  return { score, matched: uniqMatched, via: [...new Set(via)] };
}

function scoreAudience(queryAudiences, podcastAudiences) {
  const q = queryAudiences.map(norm).filter(Boolean);
  if (!q.length) return { score: 0.55, overlap: [] };
  const pod = podcastAudiences.map(norm);
  const overlap = [];
  for (const a of q) {
    // token-overlap match so "small-business owners" ~ "business owners"
    const aTokens = new Set(a.split(/\s+/));
    for (const p of pod) {
      const pTokens = p.split(/\s+/);
      const hit = pTokens.filter((t) => aTokens.has(t)).length;
      if (hit >= Math.max(1, Math.min(aTokens.size, pTokens.length) - 1)) {
        overlap.push(p); break;
      }
    }
  }
  const score = clamp01(overlap.length / q.length);
  return { score: overlap.length ? Math.max(score, 0.6) : 0.35, overlap: [...new Set(overlap)] };
}

function expandTerms(term) {
  // Map a subject to the words likely to appear in episode text.
  const t = norm(term);
  const extra = [];
  if (t === 'artificial intelligence') extra.push('ai', 'machine learning', 'algorithm');
  if (t === 'senior citizens') extra.push('senior', 'older', 'elder');
  if (t === 'african-american history') extra.push('african american', 'black');
  if (t === 'community leadership') extra.push('community', 'leader');
  if (t === 'health and wellness') extra.push('health', 'wellness');
  if (t === 'finance and investing') extra.push('finance', 'invest');
  return [t, ...extra];
}

function scoreRecency(episodes, querySubjects, relatedMap) {
  if (!episodes || !episodes.length) return { score: 0.5, hits: [], gap: true };
  const q = new Set(querySubjects.flatMap(expandTerms).filter(Boolean));
  const related = new Set();
  for (const qs of querySubjects.map(norm)) {
    for (const r of Object.keys(relatedMap[qs] || {})) related.add(r);
  }
  const now = Date.now();
  let score = 0;
  const hits = [];
  for (const ep of episodes) {
    const text = norm(`${ep.title} ${ep.description || ''}`);
    let topical = 0;
    for (const term of q) if (term && text.includes(term)) topical = 1;
    if (!topical) for (const term of related) if (term && text.includes(term)) topical = Math.max(topical, 0.6);
    if (!topical) continue;
    const ageDays = ep.published_at ? (now - Date.parse(ep.published_at)) / 86400000 : 999;
    const recencyFactor = ageDays < 90 ? 1 : ageDays < 180 ? 0.8 : ageDays < 365 ? 0.6 : 0.4;
    score = Math.max(score, topical * recencyFactor);
    hits.push(ep.title);
  }
  return { score: score || 0.4, hits: hits.slice(0, 3), gap: false };
}

function scoreGeography(queryGeo, podcast) {
  if (!queryGeo || !queryGeo.reach) return { score: 0.6 };
  const wanted = norm(queryGeo.reach);
  const reach = norm(podcast.geo_reach);
  // International & national shows are broadly reachable; local shows must match place.
  if (wanted === 'international') return { score: reach === 'international' ? 1 : reach === 'national' ? 0.75 : 0.4 };
  if (wanted === 'national')      return { score: (reach === 'national' || reach === 'international') ? 1 : 0.55 };
  // local/regional wanted: reward place match
  if (queryGeo.place) {
    const place = norm(queryGeo.place);
    const podPlace = norm(`${podcast.city || ''} ${podcast.state || ''} ${podcast.country || ''} ${podcast.location || ''}`);
    if (podPlace.includes(place)) return { score: 1 };
  }
  return { score: reach === 'local' || reach === 'regional' ? 0.7 : 0.5 };
}

function scoreCulture(queryCulture, podcastCulture) {
  if (!queryCulture) return { score: 0.6, neutral: true };
  if (!podcastCulture) return { score: 0.5, gap: true };
  const q = norm(queryCulture), p = norm(podcastCulture);
  const qTokens = q.split(/\W+/).filter(Boolean);
  const hit = qTokens.some((t) => t.length > 3 && p.includes(t));
  return { score: hit ? 1 : 0.5 };
}

function scoreOpenness(podcast) {
  let s = 0.5;
  if (podcast.accepts_guests) s += 0.3;
  if (podcast.guest_submission_url) s += 0.1;
  if (norm(podcast.format).match(/interview|co_hosted|panel/)) s += 0.1;
  return { score: clamp01(s) };
}

function scoreStory(profile) {
  if (!profile) return { score: 0.5, neutral: true };
  let s = 0.4;
  if (profile.personal_story && profile.personal_story.length > 60) s += 0.2;
  if (asArray(profile.expertise).length >= 2) s += 0.15;
  if (profile.promoting) s += 0.15;
  if (asArray(profile.previous_interviews).length) s += 0.1;
  return { score: clamp01(s) };
}

/**
 * Main entry. `query` describes what the user wants; `profile` is optional
 * guest context; `podcast` bundles the podcast row + its subjects, audiences,
 * and recent episodes. `relatedMap` is the subject-relation graph.
 */
function computeMatch({ query, profile, podcast, relatedMap = {} }) {
  const querySubjects = asArray(query.subjects);
  const queryAudiences = asArray(query.audiences);

  const subject   = scoreSubject(querySubjects, podcast.subjects || [], relatedMap);
  const audience  = scoreAudience(queryAudiences, (podcast.audiences || []));
  const recency   = scoreRecency(podcast.episodes || [], querySubjects, relatedMap);
  const geography = scoreGeography(query.geo, podcast);
  const culture   = scoreCulture(query.culture, podcast.cultural_focus);
  const openness  = scoreOpenness(podcast);
  const story     = scoreStory(profile);

  const dims = { subject, audience, recency, geography, culture, openness, story };
  let total = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) total += w * dims[k].score;

  // Subject alignment is the headline signal. When it's excellent, let it pull
  // the composite upward so a clearly on-topic show doesn't sit at "weak" just
  // because optional profile/audience fields are sparse. When it's near zero,
  // dampen the composite so openness alone can't inflate an off-topic show.
  if (subject.score >= 0.85) total = total + 0.18 * (subject.score - 0.5);
  else if (subject.score <= 0.15) total = total * 0.8;

  const score = Math.round(clamp01(total) * 100);

  return {
    score,
    breakdown: Object.fromEntries(
      Object.entries(dims).map(([k, v]) => [k, Math.round(v.score * 100)])
    ),
    reason:   buildReason(score, dims, podcast, querySubjects),
    concerns: buildConcerns(dims, podcast),
    angle:    buildAngle(dims, podcast, profile, querySubjects),
  };
}

function band(score) {
  if (score >= 85) return 'Strong Match';
  if (score >= 70) return 'Good Match';
  if (score >= 50) return 'Possible Match';
  return 'Weak Match';
}

const unslug = (s) => (s || '').replace(/-/g, ' ').replace(/\band\b/g, '&');

function buildReason(score, d, podcast, querySubjects) {
  const bits = [];
  if (d.subject.matched.length)
    bits.push(`covers ${d.subject.matched.map(unslug).join(' & ')}`);
  else if (d.subject.via.length)
    bits.push(`relates to your topic through ${d.subject.via.map(unslug).join(', ')}`);
  if (d.audience.overlap.length)
    bits.push(`reaches ${d.audience.overlap.slice(0, 2).join(' and ')}`);
  if (!d.recency.gap && d.recency.hits.length)
    bits.push(`recently ran episodes like "${d.recency.hits[0]}"`);
  if (podcast.accepts_guests) {
    const style = podcast.interview_style || podcast.format;
    const article = /^[aeiou]/i.test(style) ? 'an' : 'a';
    bits.push(`is ${article} ${style} show open to guests`);
  }
  const lead = `${score}% ${band(score)}:`;
  const body = bits.length
    ? `This podcast ${bits.join(', ')}.`
    : `Limited overlap with your topic and audience on the information available.`;
  return `${lead} ${body}`;
}

function buildConcerns(d, podcast) {
  const c = [];
  if (d.subject.score < 0.5) c.push('Topic overlap is indirect — lead with the shared angle.');
  if (d.audience.score < 0.45) c.push('Audience fit is uncertain from listed data.');
  if (d.recency.gap) c.push('No recent episode data available to confirm current focus.');
  if (!podcast.accepts_guests) c.push('No public sign this show books outside guests.');
  if (!podcast.guest_submission_url && !podcast.public_contact)
    c.push('No public submission link or contact listed.');
  return c;
}

function buildAngle(d, podcast, profile, querySubjects) {
  const topic = (d.subject.matched[0] || querySubjects[0] || 'your subject');
  const aud = d.audience.overlap[0] || podcast.audience_desc || 'this audience';
  const who = profile?.professional_title
    ? `As ${profile.professional_title}, `
    : '';
  return `${who}frame ${topic} specifically for ${aud} — tie it to a recent ${podcast.name} theme and open with your most concrete story.`;
}

module.exports = { computeMatch, WEIGHTS, band };
