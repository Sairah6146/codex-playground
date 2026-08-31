'use strict';

/**
 * Backs the SQLite file with Netlify Blobs so it survives across cold
 * starts (each of which otherwise gets a fresh, empty /tmp) and across
 * deploys — global scope (getStore, not getDeployStore), since this is
 * application data, not a deploy-specific build artifact.
 *
 * Outside a Netlify Function (e.g. local `node server/index.js`), Blobs
 * has no ambient configuration and getStore() throws; that's caught here
 * and persistence is silently skipped, so local dev keeps behaving exactly
 * as it did before this file existed — ephemeral, but that was never the
 * problem locally.
 */

const fs = require('fs');
const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'podcast-connect-db';
const BLOB_KEY = 'podcast_connect.db';

function store() {
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

async function restoreFromBlob(dbPath) {
  try {
    const data = await store().get(BLOB_KEY, { type: 'arrayBuffer' });
    if (!data) return false;
    fs.writeFileSync(dbPath, Buffer.from(data));
    return true;
  } catch {
    return false;
  }
}

async function persistToBlob(dbPath) {
  try {
    const bytes = fs.readFileSync(dbPath);
    await store().set(BLOB_KEY, bytes);
    return true;
  } catch {
    return false;
  }
}

module.exports = { restoreFromBlob, persistToBlob };
