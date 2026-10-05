# iPhone Simulator

Paste **any** URL (Vercel or otherwise) and use it in an iPhone-shaped window: tap, swipe,
type, log in, OAuth popups — the site runs in a real Chromium with iPhone emulation
(393×852 @3x, touch events, iOS Safari user agent) and is streamed to your tab.

Not an iframe, so sites that block framing, cookies/logins, and redirects all work.

## Deploy to Vercel (hosted version)

1. Vercel → **Add New Project** → import this repo.
2. Set **Root Directory** to `iphone-sim`. Framework preset: *Other*. No build command.
3. Deploy. Every push to the branch you deploy redeploys the simulator itself.

The hosted version runs in **Fast (embedded)** mode: it loads your app directly in an iPhone-sized
frame (so CSS media queries and `100vh` behave like a phone). Paste any link and press Go.

- **Reload:** ⟳ button or press `R`. **Auto-reload on deploy** polls the site every 8s and reloads
  when its build assets change (i.e. when you push a new deploy). Your last URL is remembered.
- It checks the site first and tells you if it forbids embedding (`X-Frame-Options` / CSP `frame-ancestors`).
- Limits of embedding: mouse (not touch) input, back/forward are the app's own, and cookie-based
  logins may be blocked by the browser in a cross-site frame (token/localStorage logins work).
  For those, run the local Real browser engine below — Vercel serverless can't host a live Chromium.

## Run locally (Real browser engine)

```bash
cd iphone-sim
npm install
npx playwright-core install chromium   # one-time, skip if you already have Chrome/Chromium
npm start                              # or: npm start -- my-app.vercel.app
```

Open http://localhost:4321, paste a link, hit Go.

- Drag = swipe, wheel = scroll, keyboard types into focused fields, ⌘/Ctrl+V pastes.
- Device picker: iPhone 15 Pro / Pro Max / 13 / SE. 📷 saves a screenshot.
- Logins persist in `./profile` between runs. **Clear logins** wipes them.
- `PORT=5000 npm start`, `CHROMIUM_PATH=/path/to/chrome` to override.

## Notes
- Binds to 127.0.0.1 only (it can open any URL from your machine; don't expose it).
- One session at a time. Camera, push notifications, Face ID and iOS-only APIs aren't emulated.

> The local engine lives in `local-server.js` (not `server.js`) on purpose: Vercel treats `server.js`
> as an app entry point and would try to run the browser engine in a serverless function.
