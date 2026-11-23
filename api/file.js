// GET /api/file?url=<media url>&name=<filename>&p=<passcode>
//
// Fetches one media file and passes it through to your phone.
//
// Why not download straight from the source? Browsers block a page on one
// website from reading files from another website unless that site allows
// it (a rule called CORS). These media servers don't allow it, so our
// server fetches the file and relays it.

import { Readable } from 'node:stream';
import { BROWSER_HEADERS, isAuthed } from './_lib/http.js';
import { ALLOWED_MEDIA_HOSTS } from './_lib/resolve.js';

export default async function handler(req, res) {
  if (!isAuthed(req, req.query.p)) return res.status(401).send('Wrong passcode');

  // Only relay files from the known media servers, nothing else, so nobody
  // can use this site to fetch arbitrary web pages.
  let target;
  try {
    target = new URL(String(req.query.url));
  } catch {
    return res.status(400).send('Bad url');
  }
  if (target.protocol !== 'https:' || !ALLOWED_MEDIA_HOSTS.includes(target.hostname)) {
    return res.status(400).send('That file host is not allowed');
  }

  const upstream = await fetch(target, { headers: BROWSER_HEADERS });
  if (!upstream.ok || !upstream.body) return res.status(502).send('The source refused the file');

  const name = String(req.query.name || 'file').replace(/[^\w.-]/g, '_');
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
  const length = upstream.headers.get('content-length');
  if (length) res.setHeader('Content-Length', length);
  // "attachment" = save the file rather than play it in the browser.
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);

  // Stream it through chunk by chunk instead of holding it all in memory.
  Readable.fromWeb(upstream.body).pipe(res);
}
