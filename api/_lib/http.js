import { createHash } from 'node:crypto';

// Small shared helpers for talking to other websites.
// (Folders/files starting with "_" inside api/ are not turned into URLs by
// Vercel. They're just modules the real endpoints import.)

// Look like a normal browser so sites send their normal response.
export const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

// fetch() + turn the reply into JSON, with a readable error if it fails.
export async function getJson(url) {
  const response = await fetch(url, { headers: BROWSER_HEADERS });
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  return response.json();
}

// ---------------------------------------------------------------------------
// Passcode / login
// ---------------------------------------------------------------------------
// Logging in sets a cookie (a small value the browser sends back with every
// request). The cookie holds a *hash* of the passcode, not the passcode
// itself: a scrambled fingerprint that can't be turned back into the original.
// middleware.js computes the same hash to decide whether to show the app.
export const COOKIE_NAME = 'bruh';

export function authToken() {
  return createHash('sha256').update(`bruh-v1:${process.env.APP_PASSCODE}`).digest('hex');
}

// Read one cookie's value out of the "Cookie" request header,
// which looks like "a=1; bruh=abc123; c=3".
function readCookie(req, name) {
  const pair = (req.headers.cookie || '').split(';').map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return pair ? pair.slice(name.length + 1) : null;
}

// Allowed if: no passcode is configured, OR the right passcode was sent
// directly (the iPhone Shortcut does this), OR the login cookie is valid.
export function isAuthed(req, providedPasscode) {
  const expected = process.env.APP_PASSCODE;
  if (!expected) return true;
  if (providedPasscode === expected) return true;
  return readCookie(req, COOKIE_NAME) === authToken();
}

// Run `worker` on every item, but only `limit` at a time, so we don't
// fire 50 requests at once. Returns results in the original order.
export async function mapLimited(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  // Start `limit` "lanes". Each lane keeps grabbing the next unclaimed item
  // until none are left. `await` inside the loop pauses just that lane.
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(lanes);
  return results;
}
