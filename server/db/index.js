'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { restoreFromBlob, persistToBlob } = require('./persist');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'podcast_connect.db');

let dbPromise = null;

async function bootstrap() {
  // Pull down whatever was last persisted (accounts, saves, pipeline,
  // imported real podcasts) before opening the file — a no-op outside a
  // Netlify Function, or on the very first cold start ever.
  await restoreFromBlob(DB_PATH);

  const instance = new DatabaseSync(DB_PATH);
  // Not using WAL here: persistToBlob copies this single file, and WAL
  // mode can leave recent commits sitting in a separate -wal file that a
  // straight file copy would miss.
  instance.exec('PRAGMA foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  instance.exec(schema);

  const { count } = instance.prepare('SELECT COUNT(*) AS count FROM podcasts').get();
  if (count === 0) {
    const seed = require('./seed');
    seed.run(instance);
    await persistToBlob(DB_PATH); // establish the durable baseline immediately
  }

  return instance;
}

function getDb() {
  if (!dbPromise) dbPromise = bootstrap();
  return dbPromise;
}

async function persistDb() {
  await persistToBlob(DB_PATH);
}

module.exports = { getDb, persistDb, DB_PATH };
