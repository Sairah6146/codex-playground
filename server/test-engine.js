'use strict';

/**
 * Smoke test over the spec's example searches — not a full test suite, but a
 * fast sanity check that search + the match engine agree with the demo data.
 * Run with `npm run test:engine`.
 */

const { getDb } = require('./db');
const searchService = require('./searchService');

let failures = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function topSlug(results) {
  return results[0] && results[0].slug;
}

function slugs(results) {
  return results.map((r) => r.slug);
}

(async () => {

const db = await getDb();

console.log('Podcast Connect — match engine smoke test\n');

console.log('1) Single subject: "artificial intelligence"');
{
  const { results } = searchService.search(db, { subjects: ['artificial-intelligence'] });
  check('The Algorithm Age ranks first', topSlug(results) === 'algorithm-age', `got ${topSlug(results)}`);
  check('Score is a Strong/Good match', results[0].score >= 70, `score ${results[0]?.score}`);
}

console.log('\n2) Combined subjects: AI + relationships');
{
  const { results } = searchService.search(db, { subjects: ['artificial-intelligence', 'relationships-dating'] });
  const top4 = slugs(results).slice(0, 4);
  check('Algorithm Age is surfaced', top4.includes('algorithm-age'), top4.join(', '));
  check('Modern Love Lines is surfaced via the relation graph + episode text', top4.includes('modern-love-lines'), top4.join(', '));
}

console.log('\n3) Audience search: "startup founders"');
{
  const { results } = searchService.search(db, { audiences: ['startup founders'] });
  const top4 = slugs(results).slice(0, 4);
  check('Algorithm Age surfaced', top4.includes('algorithm-age'), top4.join(', '));
  check('Bootstrapped surfaced', top4.includes('bootstrapped'), top4.join(', '));
}

console.log('\n4) Cultural fit: African-American');
{
  const { results } = searchService.search(db, { culture: 'african-american' });
  check('Roots & Rise ranks first', topSlug(results) === 'roots-and-rise', `got ${topSlug(results)}`);
}

console.log('\n5) Geography: local search for Portland');
{
  const { results } = searchService.search(db, { geo: { reach: 'local', place: 'Portland' } });
  check('Golden Years Wellness ranks first', topSlug(results) === 'golden-years-wellness', `got ${topSlug(results)}`);
}

console.log('\n6) Geography: international wellness');
{
  const { results } = searchService.search(db, { subjects: ['health-and-wellness'], geo: { reach: 'international' } });
  check('Global Wellness Hour ranks first', topSlug(results) === 'global-wellness-hour', `got ${topSlug(results)}`);
}

console.log('\n7) Episode/topic text: "swiping"');
{
  const { results } = searchService.search(db, { episodeText: 'swiping' });
  check('Modern Love Lines is found', slugs(results).includes('modern-love-lines'), slugs(results).join(', '));
}

console.log('\n8) Network/organization: "Capital Network"');
{
  const { results } = searchService.search(db, { network: 'Capital Network' });
  check('The Ledger is found', slugs(results).includes('the-ledger'), slugs(results).join(', '));
}

console.log('\n9) Podcast name: "Bootstrapped"');
{
  const { results } = searchService.search(db, { name: 'Bootstrapped' });
  check('Bootstrapped is found', slugs(results).includes('bootstrapped'), slugs(results).join(', '));
}

console.log('\n10) Natural language: "AI podcast for startup founders"');
{
  const { results, parsed } = searchService.search(db, { q: 'AI podcast for startup founders' });
  check('Parsed the AI subject', parsed.subjects.includes('artificial-intelligence'), parsed.subjects.join(', '));
  check('Parsed the startup founders audience', parsed.audiences.includes('startup founders'), parsed.audiences.join(', '));
  check('The Algorithm Age ranks first', topSlug(results) === 'algorithm-age', `got ${topSlug(results)}`);
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);

})();
