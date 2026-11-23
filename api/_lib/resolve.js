// Picks the right "source" for a link and asks it for the media.
//
// To support a new site, write a file in sources/ that exports
// `name`, `mediaHosts`, `matches(url)` and `resolve(url)`, then add it here.

import * as pinterest from './sources/pinterest.js';
import * as x from './sources/x.js';

const SOURCES = [pinterest, x];

// Every host we're willing to relay files from (used by /api/file).
export const ALLOWED_MEDIA_HOSTS = SOURCES.flatMap((s) => s.mediaHosts);

// One link in, a list of items out:
// [{ id, type: 'video'|'image', mediaUrl, ext, filename }]
export async function resolveLink(link) {
  let url;
  try {
    url = new URL(link);
  } catch {
    throw new Error("That isn't a valid link");
  }
  const source = SOURCES.find((s) => s.matches(url));
  if (!source) throw new Error('This site isn\'t supported on the web version');

  const items = await source.resolve(url);
  if (items.length === 0) throw new Error('No media found');
  // Neutral filenames: just the source letter and the item's id.
  return items.map((item) => ({ ...item, filename: `${source.name}-${item.id}.${item.ext}` }));
}
