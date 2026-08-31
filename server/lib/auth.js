'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-production';
const TOKEN_TTL = '30d';

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

// Rejects the request if no valid token is present.
function requireAuth(req, res, next) {
  const token = extractToken(req);
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Authentication required.' });
  req.userId = payload.sub;
  next();
}

// Attaches req.userId when a valid token is present, but never rejects —
// search and browsing work without an account.
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  const payload = token && verifyToken(token);
  if (payload) req.userId = payload.sub;
  next();
}

module.exports = { hashPassword, comparePassword, signToken, verifyToken, requireAuth, optionalAuth };
