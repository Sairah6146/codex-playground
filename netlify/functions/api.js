'use strict';

// Netlify Functions run on a read-only filesystem except /tmp, so the
// SQLite file has to live there. This must be set before server/db is
// required anywhere in the require chain below.
process.env.DB_PATH = process.env.DB_PATH || '/tmp/podcast_connect.db';

const serverless = require('serverless-http');
const app = require('../../server/index.js');

// Classic Lambda-compatible handler (serverless-http adapts Express's
// (req, res) interface to it) so the whole existing Express app — routes,
// middleware, everything — runs unchanged behind the function.
const rawHandler = serverless(app);

// Netlify invokes this function with the full "/.netlify/functions/api/..."
// path (see the /api/* redirect in netlify.toml); the Express app's routes
// are all defined as "/api/...". Rewrite the prefix so they match, instead
// of duplicating every route under two prefixes.
module.exports.handler = (event, context) => {
  event.path = event.path.replace(/^\/\.netlify\/functions\/api/, '/api');
  return rawHandler(event, context);
};
