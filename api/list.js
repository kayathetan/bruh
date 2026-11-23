// GET /api/list?link=<a link>&p=<passcode>
// Reply: plain text, one download address per line.
//
// Built for the iPhone Shortcut. The Shortcut sends the link you shared,
// gets this list back, then downloads each line and saves it to Photos.
// Plain text (not JSON) keeps the Shortcut simple: "split by new lines".

import { isAuthed } from './_lib/http.js';
import { resolveLink } from './_lib/resolve.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  if (!isAuthed(req, req.query.p)) return res.status(401).send('Wrong passcode');

  // The shared link should arrive URL-encoded. If it wasn't, any "&" inside
  // it would be cut off, so take everything after "link=" in the raw address.
  // (link= is always last in the shortcut's address.)
  const raw = (req.url.split('link=')[1] || '').trim();
  let link = raw;
  try { link = decodeURIComponent(raw); } catch { /* wasn't encoded, keep as is */ }

  try {
    const items = await resolveLink(link);
    // Work out our own address (whatever domain this site is running on)
    // so each line is a complete link the Shortcut can open.
    const origin = `https://${req.headers.host}`;
    const lines = items.map((item) => {
      const params = new URLSearchParams({ url: item.mediaUrl, name: item.filename, p: req.query.p || '' });
      return `${origin}/api/file?${params}`;
    });
    res.status(200).send(lines.join('\n'));
  } catch (err) {
    res.status(400).send(err.message);
  }
}
