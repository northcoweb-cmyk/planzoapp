# iPhone Simulator

Paste **any** URL (Vercel or otherwise) and use it in an iPhone-shaped window: tap, swipe,
type, log in, OAuth popups — the site runs in a real Chromium with iPhone emulation
(393×852 @3x, touch events, iOS Safari user agent) and is streamed to your tab.

Not an iframe, so sites that block framing, cookies/logins, and redirects all work.

## Run

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
