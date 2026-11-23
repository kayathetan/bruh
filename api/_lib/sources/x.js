// Source: X / Twitter posts (videos, GIFs and photos).
//
// Uses X's public *embed* data, the JSON that powers embedded posts on
// other websites. No login needed for public posts.

import { getJson } from '../http.js';

export const name = 'x';
export const mediaHosts = ['video.twimg.com', 'pbs.twimg.com'];

export function matches(url) {
  return /(^|\.)(x|twitter|fxtwitter|vxtwitter|fixupx)\.com$/.test(url.hostname);
}

// The embed endpoint wants a small "token" computed from the post ID.
// This is the same formula X's own embed code uses.
function embedToken(id) {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

export async function resolve(url) {
  // Post links look like /someone/status/1234567890
  const id = url.pathname.match(/\/status(?:es)?\/(\d+)/)?.[1];
  if (!id) throw new Error('Paste a link to a specific post');

  const post = await getJson(
    `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${embedToken(id)}&lang=en`,
  );
  const media = post.mediaDetails || [];
  if (media.length === 0) throw new Error('That post has no photos or videos');

  return media.map((m) => {
    if (m.type === 'video' || m.type === 'animated_gif') {
      // Several versions at different bitrates. Take the highest-quality mp4.
      const best = (m.video_info?.variants || [])
        .filter((v) => v.content_type === 'video/mp4')
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      return best && { id: `${id}-${m.id_str || ''}`, type: 'video', mediaUrl: best.url.split('?')[0], ext: 'mp4' };
    }
    // Photos: "?name=orig" asks for the original full-size file.
    const ext = m.media_url_https.split('.').pop();
    return { id: `${id}-${m.id_str || ''}`, type: 'image', mediaUrl: `${m.media_url_https}?name=orig`, ext };
  }).filter(Boolean);
}
