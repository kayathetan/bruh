// POST /api/login   body: { "passcode": "..." }  -> sets the login cookie
// POST /api/login   body: { "logout": true }     -> clears it
//
// The cookie is:
//   HttpOnly  : page JavaScript can't read it (safer)
//   Secure    : only sent over https
//   SameSite  : not sent when other websites link here
//   Max-Age   : stays logged in for a year (in seconds)

import { COOKIE_NAME, authToken } from './_lib/http.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const flags = 'Path=/; HttpOnly; Secure; SameSite=Lax';
  if (req.body?.logout) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${flags}; Max-Age=0`);
    return res.status(200).json({ ok: true });
  }

  if (!process.env.APP_PASSCODE || req.body?.passcode !== process.env.APP_PASSCODE) {
    return res.status(401).json({ error: 'Wrong passcode' });
  }
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${authToken()}; ${flags}; Max-Age=31536000`);
  res.status(200).json({ ok: true });
}
