'use strict';

/**
 * Demonstration data. Every podcast here is clearly flagged `is_demo = 1` and
 * shown with a "Demo data" tag in the UI (see README > About the data).
 *
 * The eight shows are written to exercise the spec's example searches:
 * single subject, combined subjects (AI + relationships), audience,
 * cultural fit, geography (local + international), episode text, and network.
 */

const { insertPodcastRecords } = require('./podcastStore');

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

const SUBJECTS = [
  { slug: 'artificial-intelligence', name: 'Artificial Intelligence' },
  { slug: 'relationships-dating', name: 'Relationships & Dating' },
  { slug: 'health-and-wellness', name: 'Health and Wellness' },
  { slug: 'finance-and-investing', name: 'Finance and Investing' },
  { slug: 'community-leadership', name: 'Community Leadership' },
  { slug: 'senior-citizens', name: 'Senior Citizens' },
  { slug: 'african-american-history', name: 'African-American History' },
  { slug: 'business-and-entrepreneurship', name: 'Business & Entrepreneurship' },
  { slug: 'parenting-and-family', name: 'Parenting & Family' },
  { slug: 'technology-and-startups', name: 'Technology & Startups' },
];

// Directed edges; matchEngine reads both directions since searches can start
// from either subject.
const SUBJECT_RELATIONS = [
  ['artificial-intelligence', 'relationships-dating', 0.7],
  ['relationships-dating', 'artificial-intelligence', 0.7],
  ['artificial-intelligence', 'technology-and-startups', 0.9],
  ['technology-and-startups', 'artificial-intelligence', 0.9],
  ['business-and-entrepreneurship', 'finance-and-investing', 0.8],
  ['finance-and-investing', 'business-and-entrepreneurship', 0.8],
  ['community-leadership', 'african-american-history', 0.6],
  ['african-american-history', 'community-leadership', 0.6],
  ['health-and-wellness', 'senior-citizens', 0.7],
  ['senior-citizens', 'health-and-wellness', 0.7],
  ['parenting-and-family', 'relationships-dating', 0.6],
  ['relationships-dating', 'parenting-and-family', 0.6],
  ['business-and-entrepreneurship', 'technology-and-startups', 0.6],
  ['technology-and-startups', 'business-and-entrepreneurship', 0.6],
];

const PODCASTS = [
  {
    slug: 'algorithm-age',
    name: 'The Algorithm Age',
    description: 'Deep conversations with the researchers, founders, and skeptics building artificial intelligence — and living with what it changes.',
    network: 'Signal Media',
    format: 'interview',
    interview_style: 'conversational',
    geo_reach: 'national',
    country: 'United States', state: null, city: null, location: 'United States',
    cultural_focus: null,
    audience_desc: 'tech professionals and startup founders',
    reach_estimate: 42000,
    accepts_guests: 1,
    guest_submission_url: 'https://algorithmage.example.com/guests',
    public_contact: 'guests@algorithmage.example.com',
    has_video: 1,
    artwork_url: null,
    website_url: 'https://algorithmage.example.com',
    verification_source: 'Publisher-submitted',
    last_verified_date: daysAgo(5),
    subjects: [['artificial-intelligence', true], ['technology-and-startups', false]],
    audiences: ['tech professionals', 'startup founders', 'engineers'],
    episodes: [
      { title: 'Why Every Startup Is Suddenly an AI Startup', description: 'The algorithm arms race, and what it means for small teams.', published_at: daysAgo(20) },
      { title: 'Machine Learning in the Real World', description: 'Where machine learning actually ships vs. where it just demos well.', published_at: daysAgo(60) },
      { title: 'The Ethics of Automated Decisions', description: 'A philosopher and an engineer disagree productively.', published_at: daysAgo(200) },
    ],
  },
  {
    slug: 'modern-love-lines',
    name: 'Modern Love Lines',
    description: 'Real talk about dating, partnership, and connection in the current era — from first swipes to long-term love.',
    network: 'Heartline Network',
    format: 'co_hosted',
    interview_style: 'candid',
    geo_reach: 'international',
    country: null, state: null, city: null, location: 'Worldwide',
    cultural_focus: null,
    audience_desc: 'young professionals and singles',
    reach_estimate: 85000,
    accepts_guests: 1,
    guest_submission_url: 'https://modernlovelines.example.com/be-a-guest',
    public_contact: null,
    has_video: 0,
    artwork_url: null,
    website_url: 'https://modernlovelines.example.com',
    verification_source: 'Publisher-submitted',
    last_verified_date: daysAgo(9),
    subjects: [['relationships-dating', true], ['parenting-and-family', false]],
    audiences: ['young professionals', 'singles', 'newlyweds'],
    episodes: [
      { title: 'Swiping Right: How AI Is Changing the Way We Date', description: 'Matching algorithms, machine learning, and what dating apps actually optimize for.', published_at: daysAgo(15) },
      { title: 'Long Distance, Longer Love', description: 'Three couples on what made distance work.', published_at: daysAgo(45) },
      { title: "When Your Partner Wants Kids and You Don't", description: 'A hard conversation, handled gently.', published_at: daysAgo(300) },
    ],
  },
  {
    slug: 'golden-years-wellness',
    name: 'Golden Years Wellness',
    description: 'Practical, upbeat conversations on healthy aging — for seniors and the people who care for them.',
    network: 'Willow Health Media',
    format: 'interview',
    interview_style: 'warm',
    geo_reach: 'local',
    country: 'United States', state: 'Oregon', city: 'Portland', location: 'Portland, Oregon',
    cultural_focus: null,
    audience_desc: 'seniors and family caregivers',
    reach_estimate: 6000,
    accepts_guests: 1,
    guest_submission_url: 'https://goldenyearswellness.example.com/guests',
    public_contact: null,
    has_video: 0,
    artwork_url: null,
    website_url: 'https://goldenyearswellness.example.com',
    verification_source: 'Publisher-submitted',
    last_verified_date: daysAgo(14),
    subjects: [['senior-citizens', true], ['health-and-wellness', false]],
    audiences: ['seniors', 'caregivers', 'retirees'],
    episodes: [
      { title: 'Staying Sharp After 70', description: 'A geriatrician on cognitive health for older and elder adults.', published_at: daysAgo(10) },
      { title: 'Nutrition for Healthy Aging', description: 'Simple wellness habits that actually stick.', published_at: daysAgo(50) },
    ],
  },
  {
    slug: 'the-ledger',
    name: 'The Ledger',
    description: 'Investing and business strategy for people building real wealth, one decision at a time.',
    network: 'Capital Network',
    format: 'interview',
    interview_style: 'sharp',
    geo_reach: 'national',
    country: 'United States', state: null, city: null, location: 'United States',
    cultural_focus: null,
    audience_desc: 'investors and business owners',
    reach_estimate: 61000,
    accepts_guests: 1,
    guest_submission_url: 'https://theledgershow.example.com/pitch',
    public_contact: null,
    has_video: 1,
    artwork_url: null,
    website_url: 'https://theledgershow.example.com',
    verification_source: 'Publisher-submitted',
    last_verified_date: daysAgo(3),
    subjects: [['finance-and-investing', true], ['business-and-entrepreneurship', false]],
    audiences: ['investors', 'business owners', 'financial advisors'],
    episodes: [
      { title: 'Reading a Balance Sheet Like a Pro', description: 'The finance basics every founder skips, and pays for later.', published_at: daysAgo(25) },
      { title: 'When to Bootstrap vs. Raise', description: 'How to invest your first dollars of runway.', published_at: daysAgo(90) },
    ],
  },
  {
    slug: 'roots-and-rise',
    name: 'Roots & Rise',
    description: 'Black history, culture, and community leadership — the stories that built movements and the people carrying them forward.',
    network: 'Heritage Voices',
    format: 'interview',
    interview_style: 'reflective',
    geo_reach: 'national',
    country: 'United States', state: null, city: null, location: 'United States',
    cultural_focus: 'African-American community and culture',
    audience_desc: 'community leaders and history enthusiasts',
    reach_estimate: 28000,
    accepts_guests: 1,
    guest_submission_url: 'https://rootsandrise.example.com/guests',
    public_contact: null,
    has_video: 0,
    artwork_url: null,
    website_url: 'https://rootsandrise.example.com',
    verification_source: 'Publisher-submitted',
    last_verified_date: daysAgo(7),
    subjects: [['african-american-history', true], ['community-leadership', false]],
    audiences: ['community leaders', 'history enthusiasts', 'educators'],
    episodes: [
      { title: 'The Organizers Who Never Made the History Books', description: 'Black community leaders whose work rarely gets credited.', published_at: daysAgo(12) },
      { title: 'African-American History Beyond February', description: 'Why one month was never going to be enough.', published_at: daysAgo(40) },
    ],
  },
  {
    slug: 'bootstrapped',
    name: 'Bootstrapped',
    description: 'Founders building companies without outside money — what actually works.',
    network: 'Founder Media',
    format: 'panel',
    interview_style: 'energetic',
    geo_reach: 'national',
    country: 'United States', state: null, city: null, location: 'United States',
    cultural_focus: null,
    audience_desc: 'startup founders and entrepreneurs',
    reach_estimate: 33000,
    accepts_guests: 1,
    guest_submission_url: 'https://bootstrappedpod.example.com/apply',
    public_contact: null,
    has_video: 1,
    artwork_url: null,
    website_url: 'https://bootstrappedpod.example.com',
    verification_source: 'Publisher-submitted',
    last_verified_date: daysAgo(11),
    subjects: [['business-and-entrepreneurship', true], ['technology-and-startups', false]],
    audiences: ['startup founders', 'entrepreneurs', 'small business owners'],
    episodes: [
      { title: 'Building an AI Feature With a Two-Person Team', description: 'Shipping an ai feature without a research budget.', published_at: daysAgo(18) },
      { title: 'The Slow Way to a Fast Company', description: 'Why some of the best founders take the long way.', published_at: daysAgo(70) },
    ],
  },
  {
    slug: 'family-table',
    name: 'Family Table',
    description: 'Parenting, partnership, and the everyday negotiations of building a family.',
    network: 'Homefront Media',
    format: 'co_hosted',
    interview_style: 'friendly',
    geo_reach: 'local',
    country: 'United States', state: 'Texas', city: 'Austin', location: 'Austin, Texas',
    cultural_focus: null,
    audience_desc: 'parents and families',
    reach_estimate: 9000,
    accepts_guests: 0,
    guest_submission_url: null,
    public_contact: 'hello@familytablepod.example.com',
    has_video: 0,
    artwork_url: null,
    website_url: 'https://familytablepod.example.com',
    verification_source: 'Publisher-submitted',
    last_verified_date: daysAgo(21),
    subjects: [['parenting-and-family', true], ['relationships-dating', false]],
    audiences: ['parents', 'families', 'new parents'],
    episodes: [
      { title: 'Merging Two Parenting Styles', description: 'What happens when co-parents disagree on the basics.', published_at: daysAgo(22) },
      { title: "Date Night on a Toddler's Schedule", description: 'Keeping a relationship alive in the early years.', published_at: daysAgo(100) },
    ],
  },
  {
    slug: 'global-wellness-hour',
    name: 'Global Wellness Hour',
    description: 'Health and wellness conversations for a worldwide audience — nutrition, movement, and mental health across cultures.',
    network: 'Wellbeing Collective',
    format: 'interview',
    interview_style: 'calm',
    geo_reach: 'international',
    country: null, state: null, city: null, location: 'Worldwide',
    cultural_focus: null,
    audience_desc: 'wellness seekers worldwide',
    reach_estimate: 120000,
    accepts_guests: 1,
    guest_submission_url: 'https://globalwellnesshour.example.com/guests',
    public_contact: null,
    has_video: 1,
    artwork_url: null,
    website_url: 'https://globalwellnesshour.example.com',
    verification_source: 'Publisher-submitted',
    last_verified_date: daysAgo(2),
    subjects: [['health-and-wellness', true]],
    audiences: ['wellness seekers', 'health professionals'],
    episodes: [
      { title: 'Mental Health Across Cultures', description: 'Health and wellness practices that travel, and ones that do not.', published_at: daysAgo(8) },
      { title: 'Movement as Medicine', description: 'Low-cost ways to build activity into daily life.', published_at: daysAgo(33) },
    ],
  },
];

function run(db) {
  db.exec('BEGIN');
  try {
    seedAll(db);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { podcasts: PODCASTS.length, subjects: SUBJECTS.length };
}

function seedAll(db) {
  const insertSubject = db.prepare('INSERT OR IGNORE INTO subjects (slug, name) VALUES (?, ?)');
  for (const s of SUBJECTS) insertSubject.run(s.slug, s.name);

  const insertRelation = db.prepare(
    'INSERT OR IGNORE INTO subject_relations (subject_slug, related_slug, weight) VALUES (?, ?, ?)'
  );
  for (const [from, to, weight] of SUBJECT_RELATIONS) insertRelation.run(from, to, weight);

  insertPodcastRecords(db, PODCASTS.map((p) => ({ ...p, is_demo: 1 })));
}

module.exports = { run, SUBJECTS, SUBJECT_RELATIONS, PODCASTS };
