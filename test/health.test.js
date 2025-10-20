const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const handleRequest = require('../src/app');

async function listen(server) {
  await new Promise((resolve) => server.listen(0, resolve));
  return server.address().port;
}

test('GET /api/health responds with ok status payload', async (t) => {
  const server = http.createServer(handleRequest);
  t.after(() => server.close());

  const port = await listen(server);
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.headers.get('content-type'), 'application/json; charset=utf-8');

  const body = await response.json();
  assert.deepStrictEqual(body, { status: 'ok' });
});

test('Non-matching routes return 404', async (t) => {
  const server = http.createServer(handleRequest);
  t.after(() => server.close());

  const port = await listen(server);
  const response = await fetch(`http://127.0.0.1:${port}/unknown`);
  assert.strictEqual(response.status, 404);
});
