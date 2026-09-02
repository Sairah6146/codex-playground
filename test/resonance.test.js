const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const handleRequest = require('../src/app');

async function listen(server) {
  await new Promise((resolve) => server.listen(0, resolve));
  return server.address().port;
}

test('POST /api/resonance rejects a missing prompt', async (t) => {
  const server = http.createServer(handleRequest);
  t.after(() => server.close());

  const port = await listen(server);
  const response = await fetch(`http://127.0.0.1:${port}/api/resonance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert.strictEqual(response.status, 400);
  const body = await response.json();
  assert.strictEqual(body.error, 'prompt is required');
});

test('POST /api/resonance rejects invalid JSON', async (t) => {
  const server = http.createServer(handleRequest);
  t.after(() => server.close());

  const port = await listen(server);
  const response = await fetch(`http://127.0.0.1:${port}/api/resonance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not valid json',
  });

  assert.strictEqual(response.status, 400);
  const body = await response.json();
  assert.strictEqual(body.error, 'Invalid JSON body');
});

test('POST /api/resonance returns 500 when ANTHROPIC_API_KEY is not configured', async (t) => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  const server = http.createServer(handleRequest);
  t.after(() => {
    server.close();
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  const port = await listen(server);
  const response = await fetch(`http://127.0.0.1:${port}/api/resonance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'hello' }),
  });

  assert.strictEqual(response.status, 500);
  const body = await response.json();
  assert.strictEqual(body.error, 'Server is not configured with an ANTHROPIC_API_KEY.');
});
