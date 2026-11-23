# bruh 🫠

**Paste links. Get everything.**

🔗 **[bruh-tawny.vercel.app](https://bruh-tawny.vercel.app)** (passcode-locked)

Videos, images, GIFs, whole boards. Paste a pile of links, or share straight from any app, and it all lands in your camera roll. No watermarks, no ads, no "please create an account", no sketchy download site trying to install three browser extensions on you.

---

## What it does

**⚡ Bulk save**
Paste 1 link or 50. Paste a messy block of text and it finds the links for you. Save the lot as a `.zip`, or send it all to Photos in one tap.

**📲 Share-sheet shortcut**
See something, tap **Share → bruh**, done. It's in your Photos before you've closed the app. Setup takes two minutes (`/shortcut.html`).

**🗂️ Entire boards and profiles**
Drop in a board or profile link and get up to its 50 most recent posts in one go. Good for raiding a whole mood board at once.

**✂️ Resize & crop studio**
Turn anything into a **16:9 thumbnail**, **9:16 story**, **1:1 square** or **4:5 portrait** at the right size. Crop to fill, or fit it on a blurred background so nothing gets cut off. It all runs on your phone, so nothing is uploaded.

**💻 Laptop mode**
`python3 download.py <links...>` adds **TikTok, Instagram, YouTube** and about a thousand other sites via [yt-dlp](https://github.com/yt-dlp/yt-dlp).

**🔒 Private by default**
The deployed site is passcode-locked, so it's yours and not a free public downloader for strangers.

---

## Works with

| | Phone (web) | Laptop |
|---|:-:|:-:|
| X / Twitter: photos, videos, GIFs | ✅ | ✅ |
| Pins, boards, profiles | ✅ | ✅ |
| TikTok | | ✅ |
| Instagram | | ✅ |
| YouTube | | ✅ |
| ~1,000 more sites | | ✅ |

TikTok, Instagram and YouTube block cloud servers, so they live on the laptop side, where they actually work.

---

## Under the hood

No database, no framework, no build step. Just a static page and three tiny serverless functions on Vercel.

```
index.html              the app: paste, save, resize
shortcut.html           iPhone Shortcut setup guide
api/resolve.js          links in → media found
api/file.js             streams each file to your device
api/list.js             plain-text version for the Shortcut
api/_lib/sources/       one small file per supported site
download.py             laptop version
```

Each site uses its own **public embed data**, the same data that powers embedded posts on blogs, which is why it doesn't break every week. Adding a new site means writing one file in `api/_lib/sources/`.

### Run your own

1. Fork this repo and import it into [Vercel](https://vercel.com/new).
2. Add an environment variable `APP_PASSCODE` with your passcode.
3. Deploy. That's it.

---

*Public content only. Saving for reference and inspiration is fine; reposting other people's work as your own is not.*
