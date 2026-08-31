'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'podcast_connect.db');

let db = null;

function bootstrap() {
  const instance = new DatabaseSync(DB_PATH);
  instance.exec('PRAGMA journal_mode = WAL');
  instance.exec('PRAGMA foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  instance.exec(schema);

  const { count } = instance.prepare('SELECT COUNT(*) AS count FROM podcasts').get();
  if (count === 0) {
    const seed = require('./seed');
    seed.run(instance);
  }

  return instance;
}

function getDb() {
  if (!db) db = bootstrap();
  return db;
}

module.exports = { getDb, DB_PATH };
