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
<title>bruh</title>
<meta name="theme-color" content="#120e14">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@1,6..96,400&family=Geist:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
</head>
<body class="lock">
<form id="f">
  <h1 class="mark">bruh</h1>
  <input id="code" type="password" autocomplete="current-password" autofocus aria-label="Passcode" placeholder="passcode">
  <button class="btn primary">Unlock</button>
  <p class="status bad" id="err" aria-live="polite"></p>
</form>
<script>
document.getElementById('f').addEventListener('submit', async (event) => {
  event.preventDefault(); // stop the form from reloading the page itself
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: document.getElementById('code').value }),
  });
  if (response.ok) return location.reload(); // cookie is set: reload shows the app
  // Wrong: shake the form once, say so, and clear the box.
  document.body.classList.remove('shake');
  void document.body.offsetWidth; // forces the browser to restart the animation
  document.body.classList.add('shake');
  document.getElementById('err').textContent = 'Wrong passcode.';
  document.getElementById('code').value = '';
});
</script>
</body>
</html>`;
