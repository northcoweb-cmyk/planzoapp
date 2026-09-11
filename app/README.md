# Planzo — React app

Vite + React 19 + TypeScript + Tailwind 4, shadcn layout (`src/components/ui`).

```bash
npm install
npm run dev            # dev server
npm run build          # assets, for the Planzo server to host
npm run build:single   # ONE self-contained HTML file → dist-single/index.html
node scripts-port.mjs  # re-port the engine after editing planzo/engine/*.js
```

## The engine is not duplicated

`src/lib/engine/` is **generated** from `planzo/engine/*.js` by
`scripts-port.mjs` — a codemod that converts CommonJS to ESM and emits a
`.d.ts` per module. Edit the source in `planzo/engine/`, run the port, and the
76 Node tests still cover the logic the UI runs. Never hand-edit a file in
`src/lib/engine/` that has the AUTO-GENERATED header.

The browser adapters beside them (`store`, `cache`, `ids`, `cost`, `places`,
`ai`, `events`) are hand-written and are the only files that talk to a network.

## Keys

| Service | Shipped in the single file? | Why |
|---|---|---|
| Ticketmaster | **Yes** | Free tier, 5,000/day, not billable |
| Open-Meteo | n/a | Keyless |
| Google Places | No — paste in Settings | Billable, and a file:// page has no referrer to restrict by |
| OpenAI | No — paste in Settings | Billable, cannot be restricted at all |

Both pasteable keys are held in `localStorage` on the user's own device and go
straight to the provider. There is a hard per-day call cap in `src/lib/config.ts`
regardless, so a demo file cannot run up a bill.

## Components

`ai-chat-input`, `apple-dock`, `admit-one-ticket`, `selector-chips` are adapted
from 21st.dev sources. Each carries a comment block naming what changed and why
— CDN icons replaced with inline SVG, simulated-speech fallbacks removed,
keyboard access added, a WebGL shader swapped for CSS. Read those before
re-pasting an upstream version over one.

## iPhone preview

```bash
npm run build:single && node make-frame.mjs   # → ../dist/planzo-iphone.html
```

Wraps the built app in an iPhone chassis for desktop viewing. The app runs in
an `<iframe srcdoc>`, deliberately — an iframe gets its own viewport, so
`100dvh`, `position: fixed` and every width media query resolve against
393x852 exactly as on the device. A CSS-scaled `<div>` would report the
desktop viewport to all of them and quietly lie about the layout.

Two things the frame has to do that are easy to miss:

- **Inject safe-area insets.** An iframe has no notch, so
  `env(safe-area-inset-*)` is 0 inside it and content draws under the
  simulated Dynamic Island. The wrapper sets `--safe-t` / `--safe-b` to what
  each device actually reports (59/34 on a 15 Pro, 20/0 on an SE).
- **Scale the chassis, not the viewport.** On a short window the frame is
  transformed to fit; the iframe's logical viewport stays 393x852.

Opened on a real phone the chassis removes itself and the app takes the
whole screen.

Known limitation: gyroscope tilt on the ticket does not work inside the frame
from `file://` — a `file://` page has no permissions policy to delegate. It
works when the app is opened directly on a phone, or served over HTTPS.
