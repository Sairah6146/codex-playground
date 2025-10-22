const { URL } = require('node:url');
const redditAlternativeHealth = require('./data/redditAlternativeHealth');

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
