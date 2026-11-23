// POST /api/resolve
// Body: { "links": ["https://pin.it/...", ...] }
// Reply: { "results": [ { link, ok, pinId, type, filename, mediaUrl } or { link, ok:false, error } ] }
//
// Finds the video/image inside each Pin. It doesn't download the media itself.
// The phone asks /api/file for each one afterwards.

import { resolvePin, passcodeOk } from './_pinterest.js';

const MAX_LINKS = 50;      // safety cap per request
const CONCURRENCY = 5;     // how many Pins we look up at the same time

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (!passcodeOk(req.headers['x-passcode'])) return res.status(401).json({ error: 'Wrong passcode' });

  // Keep only things that look like Pinterest links, and drop duplicates.
  const links = [...new Set((req.body?.links || [])
    .map((l) => String(l).trim())
    .filter((l) => /^https:\/\/(pin\.it|([a-z]+\.)?pinterest\.[a-z.]+)\//i.test(l)))]
    .slice(0, MAX_LINKS);

  if (links.length === 0) return res.status(400).json({ error: 'No Pinterest links found' });

  // Process links in small batches. Promise.all runs a batch in parallel
  // and waits for all of them to finish.
  const results = [];
  for (let i = 0; i < links.length; i += CONCURRENCY) {
    const batch = links.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(async (link) => {
      try {
        return { link, ok: true, ...(await resolvePin(link)) };
      } catch (err) {
        // One bad link shouldn't break the others, so we report and move on.
        return { link, ok: false, error: err.message };
      }
    }));
    results.push(...batchResults);
  }

  res.status(200).json({ results });
}
