// Routing Middleware: runs on Vercel BEFORE a page is sent.
//
// If you're not logged in, every page shows only the lock screen below.
// The real app HTML never leaves the server, so there's nothing to see,
// even with "view source".
//
// Returning a Response = "send this instead".
// Returning nothing    = "carry on and serve the real page".

export const config = {
  // Only guard the pages. (The api/ endpoints check the passcode themselves.)
  matcher: ['/', '/index.html', '/shortcut', '/shortcut.html'],
};

// Same hash as authToken() in api/_lib/http.js, computed with the
// browser-style crypto API that middleware has.
async function expectedToken() {
  const data = new TextEncoder().encode(`bruh-v1:${process.env.APP_PASSCODE}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  // Turn the raw bytes into a hex string like "3fa9...".
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function middleware(request) {
  if (!process.env.APP_PASSCODE) return; // no passcode configured: open site

  const cookie = (request.headers.get('cookie') || '')
    .split(';').map((c) => c.trim()).find((c) => c.startsWith('bruh='));
  if (cookie && cookie.slice(5) === (await expectedToken())) return; // logged in

  return new Response(LOCK_SCREEN, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// The lock screen: a passcode box and nothing else.
const LOCK_SCREEN = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>🔒</title>
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#111; color:#f2f2f2; font:16px/1.4 -apple-system, system-ui, sans-serif; }
  form { width:min(320px, calc(100vw - 32px)); text-align:center; }
  .lock { font-size:40px; margin-bottom:16px; }
  input { width:100%; box-sizing:border-box; background:#1c1c1c; color:#f2f2f2; border:1px solid #333; border-radius:12px; padding:14px; font:inherit; text-align:center; }
  button { width:100%; margin-top:10px; padding:14px; border:0; border-radius:12px; font:600 16px/1 inherit; color:#fff; background:#7c5cff; }
  p { color:#ff6b6b; min-height:1.4em; }
</style>
</head>
<body>
<form id="f">
  <div class="lock">🔒</div>
  <input id="code" type="password" autocomplete="current-password" autofocus aria-label="Passcode">
  <button>Unlock</button>
  <p id="err"></p>
</form>
<script>
document.getElementById('f').addEventListener('submit', async (event) => {
  event.preventDefault(); // stop the form from reloading the page itself
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: document.getElementById('code').value }),
  });
  if (response.ok) location.reload(); // cookie is set: reload shows the app
  else document.getElementById('err').textContent = 'Nope.';
});
</script>
</body>
</html>`;
