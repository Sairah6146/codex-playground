'use strict';

const dns = require('node:dns').promises;

/**
 * Fetch wrapper for outbound requests to URLs that ultimately come from
 * user-influenced input (here: podcast feed URLs sourced from a public
 * directory search) rather than from our own hardcoded endpoints. Guards
 * against SSRF: only http/https, only public (non-private/loopback/
 * link-local) resolved addresses, no automatic redirect following (a
 * redirect to an internal host would otherwise bypass the check above),
 * and a hard timeout so one slow host can't hang the request.
 */

function isPrivateAddress(address, family) {
  if (family === 4) {
    const [a, b] = address.split('.').map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  const lower = address.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80')) return true; // link-local
  if (/^fc[0-9a-f]{2}:|^fd[0-9a-f]{2}:/.test(lower)) return true; // unique local fc00::/7
  if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7), 4); // IPv4-mapped
  return false;
}

async function assertPublicHttpUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Refusing non-http(s) URL scheme: ${parsed.protocol}`);
  }
  const { address, family } = await dns.lookup(parsed.hostname);
  if (isPrivateAddress(address, family)) {
    throw new Error(`Refusing to fetch a private/internal address (${address})`);
  }
  return parsed;
}

async function safeFetch(urlString, { timeoutMs = 8000, ...options } = {}) {
  await assertPublicHttpUrl(urlString);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(urlString, {
      ...options,
      redirect: 'manual', // a redirect target is unvalidated — treat it as failure, not silently follow it
      signal: controller.signal,
    });
    if (res.status >= 300 && res.status < 400) {
      throw new Error(`Refusing to follow redirect (status ${res.status})`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { safeFetch, assertPublicHttpUrl };
