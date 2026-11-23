// Source: Pinterest. Handles single Pins, boards and profiles.
//
// Everything goes through Pinterest's public *embed widget* data (the same
// JSON blogs use to show a Pin or board). It's more reliable than scraping
// the normal page, which Pinterest strips down for cloud servers.

import { BROWSER_HEADERS, getJson, mapLimited } from '../http.js';

export const name = 'p';
export const mediaHosts = ['v1.pinimg.com', 'i.pinimg.com'];

const WIDGET = 'https://widgets.pinterest.com/v3/pidgets';

// Does this link belong to this source?
export function matches(url) {
  return url.hostname === 'pin.it' || /(^|\.)pinterest\.[a-z.]+$/.test(url.hostname);
}

// Pinterest's quality labels, best first. Some files are named by width
// instead ("..._720w.mp4"), so wider = better for those.
const QUALITY = ['V_EXP7', 'V_1080P', 'V_720P', 'V_EXP6', 'V_EXP5', 'V_EXP4',
  'V_480P', 'V_EXP3', 'V_360P', 'V_240P'];
function qualityRank(url) {
  const i = QUALITY.findIndex((label) => url.toUpperCase().includes(label));
  if (i !== -1) return i;
  const width = url.match(/_(\d{3,4})w\.mp4/);
  return width ? 100 - Number(width[1]) / 100 : 1000;
}

// Turn one Pin's widget data into a downloadable item (or null).
async function pinToItem(pin) {
  // Video links can sit in several places in the data (normal video pins,
  // "idea"/story pins...), so search the whole JSON text for .mp4 links.
  const text = JSON.stringify(pin);
  const videos = [...new Set(text.match(/https:\/\/v1\.pinimg\.com\/videos[^"\s]*?\.mp4/g) || [])]
    .sort((a, b) => qualityRank(a) - qualityRank(b));
  if (videos.length) return { id: pin.id, type: 'video', mediaUrl: videos[0], ext: 'mp4' };

  // Images come in sizes like ".../564x/ab/cd.jpg". "originals" = full size.
  const sized = pin.images?.['564x']?.url;
  if (!sized) return null;
  const original = sized.replace('/564x/', '/originals/');
  const check = await fetch(original, { method: 'HEAD', headers: BROWSER_HEADERS });
  const mediaUrl = check.ok ? original : sized;
  return { id: pin.id, type: 'image', mediaUrl, ext: mediaUrl.split('.').pop() };
}

// Full details for many Pins. The widget accepts several IDs at once,
// comma-separated, so we ask in groups of 10.
async function pinsById(ids) {
  const groups = [];
  for (let i = 0; i < ids.length; i += 10) groups.push(ids.slice(i, i + 10));
  const answers = await mapLimited(groups, 3, (group) =>
    getJson(`${WIDGET}/pins/info/?pin_ids=${group.join(',')}`));
  const pins = answers.flatMap((a) => a.data || []).filter(Boolean);
  const items = await mapLimited(pins, 8, pinToItem);
  return items.filter(Boolean);
}

// Main entry: one link in, a list of items out.
export async function resolve(url) {
  // Short pin.it links redirect to the real address (a Pin OR a board),
  // so follow the redirect first and work with where it lands.
  if (url.hostname === 'pin.it') {
    const response = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
    url = new URL(response.url);
  }

  // Single Pin: /pin/1234567890/
  const pinId = url.pathname.match(/\/pin\/(\d+)/)?.[1];
  if (pinId) return pinsById([pinId]);

  // Otherwise: /username/ is a profile, /username/boardname/ is a board.
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length === 0) throw new Error("That link doesn't point to anything");
  const [user, board] = parts;
  const listUrl = board
    ? `${WIDGET}/boards/${encodeURIComponent(user)}/${encodeURIComponent(board)}/pins/`
    : `${WIDGET}/users/${encodeURIComponent(user)}/pins/`;

  // The widget returns up to 50 of the most recent Pins.
  const list = await getJson(listUrl);
  const ids = (list.data?.pins || []).map((p) => p.id);
  if (ids.length === 0) throw new Error('Nothing found there (private or empty?)');
  return pinsById(ids);
}
