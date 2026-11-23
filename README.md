# bruh

Paste links, save the videos and images in them. Works on a phone (web app) and on a laptop (script).

## Web app (phone)

A small site on Vercel, protected by a passcode (`APP_PASSCODE` in the Vercel project settings).

- **Save media:** paste any number of links, then download everything as a `.zip` or save it straight to Photos.
- **Share-sheet shortcut:** an iPhone Shortcut that saves media from any app's Share button. Setup steps are at `/shortcut.html`.
- **Resize & crop:** turn images into 16:9, 9:16, 1:1 or 4:5 at standard sizes, cropped to fill or fitted on a blurred background. This runs entirely in the browser.

Supported on the web: X posts (photos, videos, GIFs), plus image/video pins, boards and profiles. Boards and profiles return their most recent 50 items.

### How it's built

| File | What it does |
|---|---|
| `index.html` | The page: paste links, save, resize |
| `shortcut.html` | Instructions for the iPhone Shortcut |
| `api/resolve.js` | Takes links, returns the media found in each |
| `api/file.js` | Relays one media file to the browser (sites block browsers from downloading their files directly) |
| `api/list.js` | Plain-text version of resolve for the Shortcut |
| `api/_lib/sources/*.js` | One file per supported site, using each site's public embed data |

To add a site: write a new file in `api/_lib/sources/` and register it in `api/_lib/resolve.js`.

## Laptop script

```bash
python3 download.py <link> <link> ...
```

This handles everything the web app does, plus TikTok, Instagram, YouTube and many more through [yt-dlp](https://github.com/yt-dlp/yt-dlp) (`brew install yt-dlp`). Those sites block cloud servers, which is why they're laptop-only. Files go to `downloads/`.

## Notes

Public content only. What you download still belongs to whoever made it: fine to save for reference, but not to repost as your own.
