const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const handleRequest = require('../src/app');

async function listen(server) {
  await new Promise((resolve) => server.listen(0, resolve));
  return server.address().port;
}

test('GET /api/reddit/alternative-health returns curated communities', async (t) => {
  const server = http.createServer(handleRequest);
  t.after(() => server.close());

  const port = await listen(server);
  const response = await fetch(`http://127.0.0.1:${port}/api/reddit/alternative-health`);

  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.headers.get('content-type'), 'application/json; charset=utf-8');

  const body = await response.json();

  assert.ok(body.meta);
  assert.strictEqual(body.meta.source, 'Reddit');
  assert.ok(body.meta.description.includes('communities'));

  assert.ok(Array.isArray(body.communities));
  assert.ok(body.communities.length >= 5);

  const altHealthCommunity = body.communities.find(
    (community) => community.name === 'r/AlternativeHealth'
  );
  assert.ok(altHealthCommunity, 'Expected r/AlternativeHealth to be included in the list.');
  assert.strictEqual(altHealthCommunity.type, 'subreddit');
  assert.ok(Array.isArray(altHealthCommunity.focusTopics));
});
