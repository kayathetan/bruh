// Shared helpers used by both API routes.
//
// A file whose name starts with "_" inside api/ is NOT turned into its own
// URL by Vercel. It's just a normal module the other files import.
//
// This is the JavaScript version of the logic in download_pin.py.

// Pretend to be a normal browser so Pinterest sends the full page.
export const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Pinterest's quality labels, best first.
const QUALITY_ORDER = ['V_EXP7', 'V_1080P', 'V_720P', 'V_EXP6', 'V_EXP5',
  'V_EXP4', 'V_480P', 'V_EXP3', 'V_360P', 'V_240P'];

// Media hosts we're willing to download from. The file proxy refuses
// anything else, so nobody can use our server to fetch arbitrary websites.
export const ALLOWED_MEDIA_HOSTS = ['v1.pinimg.com', 'i.pinimg.com'];

// Inside Pinterest's JSON a "/" may be written as "\/" or "/".
function unescapeUrl(url) {
  return url.replaceAll('\\u002F', '/').replaceAll('\\/', '/');
}

// Higher-quality URLs get smaller numbers so they sort first. Pinterest
// also names some files by width, like "..._720w.mp4", so we use that too.
function qualityRank(url) {
  const lower = url.toLowerCase();
  const index = QUALITY_ORDER.findIndex((label) => lower.includes(label.toLowerCase()));
  if (index !== -1) return index;
  const width = lower.match(/_(\d{3,4})w\.mp4/);
  // A width of 1080 ranks better than 720: subtract it so bigger = smaller rank.
  return width ? 100 - Number(width[1]) / 100 : 1000;
}

// Search the page HTML for video and image addresses.
function findMedia(html) {
  // (?:\\\/|\/) matches either an escaped "\/" or a plain "/".
  const videoRe = /https:(?:\\\/|\/){2}v1\.pinimg\.com(?:\\\/|\/)videos[^"\s]*?\.mp4/g;
  const imageRe = /https:(?:\\\/|\/){2}i\.pinimg\.com(?:\\\/|\/)originals[^"\s]*?\.(?:jpg|jpeg|png|gif|webp)/g;

  // match() with a /g pattern returns every match (or null if none).
  // new Set(...) removes duplicates; [... ] turns it back into an array.
  const videos = [...new Set((html.match(videoRe) || []).map(unescapeUrl))]
    .sort((a, b) => qualityRank(a) - qualityRank(b));
  const images = [...new Set((html.match(imageRe) || []).map(unescapeUrl))];
  return { videos, images };
}

// Work out the Pin's ID number from a link.
// Full links already contain it: pinterest.com/pin/1234567890/
// Short pin.it links redirect to the full link, so we follow the redirect.
async function getPinId(link) {
  const direct = link.match(/\/pin\/(\d+)/);
  if (direct) return direct[1];
  // fetch() follows redirects automatically; response.url is where it landed.
  const response = await fetch(link, { headers: BROWSER_HEADERS, redirect: 'follow' });
  const landed = response.url.match(/\/pin\/(\d+)/);
  if (!landed) throw new Error("Couldn't find a Pin at that link");
  return landed[1];
}

// Take one link the user pasted and work out what to download.
// "async" means this function does slow work (network requests) and
// returns a Promise. Callers use "await" to wait for the result.
export async function resolvePin(link) {
  const pinId = await getPinId(link);

  // Pinterest's public embed widget (what blogs use to show a Pin) returns
  // the Pin's data as JSON. It's more reliable than the normal Pin page,
  // which Pinterest sends in a stripped-down form to cloud servers like Vercel.
  const widget = await fetch(
    `https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`,
    { headers: BROWSER_HEADERS },
  );
  if (!widget.ok) throw new Error(`Pinterest returned ${widget.status}`);
  const text = await widget.text();

  // Videos: search the whole JSON text for .mp4 links (they can sit in
  // several different places depending on the kind of Pin).
  const { videos } = findMedia(text);
  if (videos.length > 0) {
    return { pinId, type: 'video', mediaUrl: videos[0], filename: `${pinId}.mp4` };
  }

  // Images: the widget gives sized versions like ".../564x/ab/cd/ef.jpg".
  // Swapping "564x" for "originals" gives the full-size file.
  const pin = JSON.parse(text)?.data?.[0];
  const sized = pin?.images?.['564x']?.url;
  if (sized) {
    const original = sized.replace('/564x/', '/originals/');
    // Check the full-size version exists; if not, settle for the 564px one.
    const check = await fetch(original, { method: 'HEAD', headers: BROWSER_HEADERS });
    const mediaUrl = check.ok ? original : sized;
    const ext = mediaUrl.split('.').pop();
    return { pinId, type: 'image', mediaUrl, filename: `${pinId}.${ext}` };
  }
  throw new Error('No media found (private or deleted Pin)');
}

// Optional passcode so only you can use the deployed site.
// If APP_PASSCODE isn't set in Vercel, the site is open to anyone.
export function passcodeOk(provided) {
  const expected = process.env.APP_PASSCODE;
  return !expected || provided === expected;
}
