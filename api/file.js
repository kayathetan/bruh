// GET /api/file?url=<pinimg url>&name=<filename>&p=<passcode>
//
// Fetches one media file from Pinterest and passes it through to the phone.
//
// Why not let the phone download from Pinterest directly? Browsers block a
// page on one website from reading files from another website unless that
// site allows it (a rule called CORS). Pinterest's video server doesn't allow
// it, so our server fetches the file and relays it.

import { Readable } from 'node:stream';
import { ALLOWED_MEDIA_HOSTS, BROWSER_HEADERS, passcodeOk } from './_pinterest.js';

export default async function handler(req, res) {
  if (!passcodeOk(req.query.p)) return res.status(401).send('Wrong passcode');

  // Only relay files from Pinterest's media servers, nothing else.
  let target;
  try {
    target = new URL(String(req.query.url));
  } catch {
    return res.status(400).send('Bad url');
  }
  if (target.protocol !== 'https:' || !ALLOWED_MEDIA_HOSTS.includes(target.hostname)) {
    return res.status(400).send('Only Pinterest media is allowed');
  }

  const upstream = await fetch(target, { headers: BROWSER_HEADERS });
  if (!upstream.ok || !upstream.body) return res.status(502).send('Pinterest refused the file');

  // Keep the filename simple: letters, numbers, dot, dash, underscore.
  const name = String(req.query.name || 'pin').replace(/[^\w.-]/g, '_');
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
  const length = upstream.headers.get('content-length');
  if (length) res.setHeader('Content-Length', length);
  // "attachment" tells the browser to save the file rather than play it.
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);

  // Stream the file through piece by piece instead of loading it all into
  // memory first. Readable.fromWeb converts fetch's stream into Node's kind,
  // and .pipe(res) sends each chunk on to the phone as it arrives.
  Readable.fromWeb(upstream.body).pipe(res);
}
