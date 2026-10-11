import type { NextApiRequest, NextApiResponse } from 'next';

// Any HTTPS origin on an "angaadi.<tld>" domain (and its subdomains) is allowed
// automatically, so moving to a new TLD (angaadi.dev -> angaadi.app -> ...)
// needs no code or config change. This is safe because the API authenticates
// with a Bearer token in the Authorization header, never with cookies, and
// responses never set Access-Control-Allow-Credentials: a look-alike domain
// gains nothing it couldn't already get by calling the API from a script.
const SITE_ORIGIN_PATTERN = /^https:\/\/([a-z0-9-]+\.)*angaadi\.[a-z]{2,63}(\.[a-z]{2,3})?$/;

// Origins that are always allowed in addition to the pattern above.
// More can be added WITHOUT a code change through the ALLOWED_ORIGINS env var
// in Vercel (comma separated). Entries in ALLOWED_ORIGINS are merged with this
// list (they no longer replace it), and may use a leading wildcard subdomain,
// e.g. "https://*.example.com".
const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3300',
  'http://localhost:5173',
  'https://angaadi.vercel.app',
  // Legacy domain that doesn't match SITE_ORIGIN_PATTERN
  'https://angaad.online',
  'https://www.angaad.online',
];

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '').toLowerCase();
}

export function getAllowedOrigins(env: string | undefined = process.env.ALLOWED_ORIGINS): string[] {
  const fromEnv = (env || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_ORIGINS.map(normalizeOrigin), ...fromEnv]));
}

function matchesPattern(origin: string, pattern: string): boolean {
  if (pattern === origin) return true;

  // "https://*.example.com" matches any subdomain of example.com (not the apex).
  const wildcard = pattern.match(/^(https?:\/\/)\*\.(.+)$/);
  if (!wildcard) return false;
  const [, scheme, baseHost] = wildcard;
  if (!origin.startsWith(scheme)) return false;
  const host = origin.slice(scheme.length);
  return host.endsWith(`.${baseHost}`) && /^[a-z0-9.-]+(:\d+)?$/.test(host);
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[] = getAllowedOrigins()): boolean {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  if (SITE_ORIGIN_PATTERN.test(normalized)) return true;
  return allowedOrigins.some((pattern) => matchesPattern(normalized, pattern));
}

export const corsWithWhitelist = async (req: NextApiRequest, res: NextApiResponse) => {
  const origin = req.headers.origin;

  // Set common headers
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  // The response differs per Origin, so caches (including Vercel's edge) must key on it.
  res.setHeader('Vary', 'Origin');

  // In development, allow all origins
  if (process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    // In production, only allow whitelisted origins
    if (origin && isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    // If the origin is not in the list, the header is NOT set.
    // The browser will then correctly block the request. This is the desired behavior.
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return false; // Stop further execution
  }

  return true; // Continue to the API route handler
};
