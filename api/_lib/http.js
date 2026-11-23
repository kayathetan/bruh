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

// Optional passcode so only you can use the deployed site.
// If APP_PASSCODE isn't set in Vercel, the site is open to anyone.
export function passcodeOk(provided) {
  const expected = process.env.APP_PASSCODE;
  return !expected || provided === expected;
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
