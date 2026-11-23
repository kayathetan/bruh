"""
download_pin.py: save a public Pinterest video (or image) to your computer.

Usage (in Terminal, from this folder):
    python3 download_pin.py https://pin.it/abc123
    python3 download_pin.py https://www.pinterest.com/pin/1234567890/

The file lands in the `downloads/` folder next to this script.

HOW IT WORKS (the same idea sites like KlickPin use):
  1. Follow the link. A short "pin.it/..." link redirects to the full Pin page.
  2. Download that Pin page's HTML, the same text your browser receives.
  3. Pinterest hides the real media addresses inside that HTML
     (in a big block of JSON data). We search the text for them:
        - videos live on  v1.pinimg.com/videos/...  (.mp4 or .m3u8)
        - images live on  i.pinimg.com/originals/... (full size)
  4. Pick the best one and download it straight from Pinterest's servers.
  5. If the video only exists as an .m3u8 "playlist" (the video split into
     many small chunks for streaming), we ask ffmpeg to stitch the chunks
     back into one .mp4 file.

Only uses Python's built-in libraries, so there's nothing to pip install.
ffmpeg is only needed for step 5 (install with: brew install ffmpeg).
"""

# --- Imports ---------------------------------------------------------------
# These all come with Python itself (the "standard library").
import re                      # "regular expressions": pattern-matching on text
import shutil                  # used here to check whether ffmpeg is installed
import subprocess              # lets Python run another program (ffmpeg)
import sys                     # gives us the command-line arguments
import urllib.request          # downloads web pages and files
from pathlib import Path       # a friendlier way to work with file paths

# Pretend to be a normal browser. Some sites send a stripped-down page
# (or refuse entirely) to requests that don't look like a browser.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# Where downloaded files go: a "downloads" folder beside this script.
# __file__ is the path of this script; .parent is the folder it's in.
DOWNLOAD_DIR = Path(__file__).parent / "downloads"

# Video quality labels Pinterest uses, best first. When a Pin has several
# versions of the same video, we take the first one on this list we find.
QUALITY_ORDER = ["V_EXP7", "V_1080P", "V_720P", "V_EXP6", "V_EXP5",
                 "V_EXP4", "V_480P", "V_EXP3", "V_360P", "V_240P"]


def fetch_page(url):
    """Download a web page. Returns (final_url_after_redirects, html_text)."""
    request = urllib.request.Request(url, headers=HEADERS)
    # "with" makes sure the connection is closed when we're done.
    with urllib.request.urlopen(request, timeout=30) as response:
        final_url = response.geturl()          # where the redirects ended up
        html = response.read().decode("utf-8", errors="replace")
    return final_url, html


def clean(url):
    """Media URLs inside Pinterest's JSON are 'escaped': a forward slash
    can appear as \\/ or \\u002F. Undo that so the URL is usable."""
    return url.replace("\\u002F", "/").replace("\\/", "/")


def quality_rank(url):
    """Smaller number = better quality. Used to sort video URLs."""
    for rank, label in enumerate(QUALITY_ORDER):
        if label.lower() in url.lower():
            return rank
    return len(QUALITY_ORDER)  # unknown label: put it last


def find_media(html):
    """Search the page HTML for video and image addresses.
    Returns (list_of_mp4_urls, list_of_m3u8_urls, list_of_image_urls)."""
    # The pattern means: "https://v1.pinimg.com/videos/" followed by any
    # characters that aren't a quote, space or backslash-quote, ending in
    # .mp4 or .m3u8. (?:\\/|/) matches either an escaped or a normal slash.
    video_pattern = r'https:(?:\\/|/){2}v1\.pinimg\.com(?:\\/|/)videos[^"\s]*?\.(?:mp4|m3u8)'
    image_pattern = r'https:(?:\\/|/){2}i\.pinimg\.com(?:\\/|/)originals[^"\s]*?\.(?:jpg|jpeg|png|gif|webp)'

    # re.findall returns every match. set() removes duplicates.
    videos = {clean(u) for u in re.findall(video_pattern, html)}
    images = {clean(u) for u in re.findall(image_pattern, html)}

    # Split videos into direct .mp4 files and .m3u8 streaming playlists,
    # each sorted best quality first.
    mp4s = sorted((u for u in videos if u.endswith(".mp4")), key=quality_rank)
    m3u8s = sorted((u for u in videos if u.endswith(".m3u8")), key=quality_rank)
    return mp4s, m3u8s, sorted(images)


def pin_id_from(url):
    """Pull the number out of '.../pin/1234567890/' to use as a filename."""
    match = re.search(r"/pin/(\d+)", url)
    return match.group(1) if match else "pin"


def download_file(url, destination):
    """Stream a file from `url` to disk in chunks (so big videos don't
    have to fit in memory all at once)."""
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=60) as response, \
            open(destination, "wb") as out_file:      # "wb" = write bytes
        shutil.copyfileobj(response, out_file)


def stitch_m3u8(url, destination):
    """Use ffmpeg to turn a streaming playlist into one .mp4 file."""
    if shutil.which("ffmpeg") is None:
        sys.exit("This video needs ffmpeg. Install it with: brew install ffmpeg")
    # -c copy = copy the video/audio as-is (fast, no quality loss)
    # -y      = overwrite the output file if it already exists
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-i", url, "-c", "copy", str(destination)],
        check=True,  # raise an error if ffmpeg fails
    )


def main():
    # sys.argv is the list of words typed on the command line.
    # sys.argv[0] is the script name, sys.argv[1] is the Pin link.
    if len(sys.argv) != 2:
        sys.exit("Usage: python3 download_pin.py <pinterest pin link>")
    link = sys.argv[1]

    print(f"Opening {link} ...")
    final_url, html = fetch_page(link)
    pin_id = pin_id_from(final_url)
    mp4s, m3u8s, images = find_media(html)

    DOWNLOAD_DIR.mkdir(exist_ok=True)  # create the folder if it's missing

    # Prefer a direct .mp4, then a stitched .m3u8, then fall back to an image.
    if mp4s:
        target = DOWNLOAD_DIR / f"{pin_id}.mp4"
        print("Found a video, downloading...")
        download_file(mp4s[0], target)
    elif m3u8s:
        target = DOWNLOAD_DIR / f"{pin_id}.mp4"
        print("Found a streaming video, stitching it together with ffmpeg...")
        stitch_m3u8(m3u8s[0], target)
    elif images:
        # Keep the image's own extension (.jpg, .png, .gif...).
        extension = Path(images[0]).suffix
        target = DOWNLOAD_DIR / f"{pin_id}{extension}"
        print("No video on this Pin, downloading the full-size image...")
        download_file(images[0], target)
    else:
        sys.exit(
            "Couldn't find any media on that page. The Pin may be private or "
            "deleted, or Pinterest may have changed how its pages are built."
        )

    print(f"Saved: {target}")


# This line means "only run main() when the script is run directly",
# not when another Python file imports it.
if __name__ == "__main__":
    main()
