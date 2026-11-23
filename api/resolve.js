// POST /api/resolve
// Body:  { "links": ["https://...", ...] }
// Reply: { "results": [ { link, ok: true, items: [...] } or { link, ok: false, error } ] }
//
// Finds the media behind each link. One link can give several items
// (a board, a profile, or a post with several photos).

import { passcodeOk, mapLimited } from './_lib/http.js';
import { resolveLink } from './_lib/resolve.js';

const MAX_LINKS = 50;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (!passcodeOk(req.headers['x-passcode'])) return res.status(401).json({ error: 'Wrong passcode' });

  // Clean up the list: trim spaces, drop blanks and duplicates, cap the count.
  const links = [...new Set((req.body?.links || []).map((l) => String(l).trim()).filter(Boolean))]
    .slice(0, MAX_LINKS);
  if (links.length === 0) return res.status(400).json({ error: 'No links found' });

  // Look up 4 links at a time. One failing link doesn't stop the others.
  const results = await mapLimited(links, 4, async (link) => {
    try {
      return { link, ok: true, items: await resolveLink(link) };
    } catch (err) {
      return { link, ok: false, error: err.message };
    }
  });

  res.status(200).json({ results });
}
