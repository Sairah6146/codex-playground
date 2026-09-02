const { URL } = require('node:url');
const redditAlternativeHealth = require('./data/redditAlternativeHealth');
const { requestResonance } = require('./resonanceClient');

const MAX_BODY_BYTES = 1e6;

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

async function handleResonanceRequest(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
    return;
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    sendJson(res, 400, { error: 'prompt is required' });
    return;
  }

  try {
    const text = await requestResonance({ prompt, maxTokens: body.max_tokens });
    sendJson(res, 200, { text });
  } catch (err) {
    if (err.message === 'ANTHROPIC_API_KEY is not set') {
      sendJson(res, 500, { error: 'Server is not configured with an ANTHROPIC_API_KEY.' });
      return;
    }
    console.error('Anthropic request failed:', err);
    sendJson(res, 502, { error: 'Failed to reach Claude API.' });
  }
}

function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    const payload = JSON.stringify({ status: 'ok' });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      'Cache-Control': 'no-store',
    });
    res.end(payload);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/resonance') {
    handleResonanceRequest(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/reddit/alternative-health') {
    const payload = JSON.stringify({
      meta: {
        description:
          'Curated Reddit communities where members explore and discuss alternative and holistic health practices.',
        source: 'Reddit',
      },
      communities: redditAlternativeHealth,
    });

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      'Cache-Control': 'no-store',
    });
    res.end(payload);
    return;
  }

  res.statusCode = 404;
  res.end('Not Found');
}

module.exports = handleRequest;
