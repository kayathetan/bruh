# bruh

A tiny personal tool that saves a public Pinterest video (or image) to your computer.

## Use it

```bash
python3 download_pin.py https://pin.it/abc123
```

The file is saved in `downloads/`. Plain Python, nothing to install. You only need [ffmpeg](https://ffmpeg.org) (`brew install ffmpeg`) for videos that Pinterest only serves as a stream.

## How it works

1. Follows the link (short `pin.it` links redirect to the full Pin page).
2. Downloads the Pin page's HTML.
3. Searches that HTML for the real media addresses Pinterest embeds in it:
   videos on `v1.pinimg.com/videos/...`, full-size images on `i.pinimg.com/originals/...`.
4. Downloads the best-quality one directly from Pinterest's servers.
5. If the video only exists as an `.m3u8` stream, ffmpeg joins the pieces into one `.mp4`.

Read `download_pin.py` for the full explanation, step by step in the comments.

## Notes

- Public Pins only. Private, deleted and login-only Pins won't work.
- If Pinterest changes how its pages are built, step 3 can stop finding anything. That's the reason sites like KlickPin keep going down and getting "restored".
- Downloaded content still belongs to whoever made it. This is for personal saving, not for reposting.
