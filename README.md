# Planzo

**Send the idea. We'll make the plan.**

A group-planning and real-world decision engine. Someone describes what they
want to do, shares one link into a group chat, and their friends answer a few
adaptive questions in a browser — no app, no account. Planzo resolves everyone's
constraints against real data and produces one executable plan.

---

## Run it

```bash
cd planzo
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # → PLANZO_SECRET
npm start
```

Open http://localhost:4000

Zero dependencies. Node 18+. It runs with an empty `.env` — storage falls back
to local files, venue search reports unavailable, AI is off, and the planning
engine works completely.

```bash
npm test              # 76 unit tests
node scripts/e2e.js   # 23 end-to-end API tests (server must be running)
npm run build         # regenerate the standalone single-file builds
```

## Standalone single-file builds

```bash
node scripts/build-standalone.js
```

Produces two files in `dist/` that need no server, no build step and no
dependencies. Open either directly in a browser.

| File | What it does |
|---|---|
| `dist/planzo-waitlist.html` | The landing page. Set `API_BASE` at the top of the file to post signups to a running Planzo server; left empty it runs in preview mode, saves to this browser only, says so plainly, and exports CSV |
| `dist/planzo-app.html` | The whole app. Full decision engine, plan generation and live weather, running locally. Add people yourself and answer as each |

The app file is **generated from** `engine/*.js`, which are inlined verbatim
inside a small CommonJS shim with browser adapters for the Node-only modules.
The standalone build therefore runs the exact code `npm test` covers and cannot
drift from it.

What the standalone app deliberately cannot do: share a link your friends open
on their own phones (needs a server), and venue search (Google Places needs a
server-side key — shipping one inside a downloadable file would leak it). Both
report unavailable rather than being faked.

## Three surfaces

| URL | What it is |
|---|---|
| `/` | Waitlist landing page — real backend, real duplicate protection |
| `/app` | The PWA. Installable, offline shell, five-tab navigation |
| `/p/<code>` | The participant flow. No account, no download |

---

## What's built

Every screen in the spec's list, in both builds unless noted.

| Area | Status |
|---|---|
| Adaptive questions + group decision engine | Full |
| Hard-constraint resolution (budget, radius, dietary) | Full |
| Plan generation, transport ranking, cost estimates | Full |
| Multi-day trips | Full |
| Groups + group memory | Full |
| Personal memory (stability, source, confidence) | Full |
| Events: creation, RSVP, capacity, visibility, updates | Full |
| Organizations + role-based permissions | Full |
| Planzo tickets with real QR + Pulse credential | Full |
| Door check-in: scanner, manual fallback, state machine | Full |
| Expense splitting + settle-up | Full |
| Calendar export (.ics) + reminders | Full |
| Natural-language search | Full |
| Live weather | Full — Open-Meteo, free, keyless |
| Waitlist | Full |
| Shareable participant links | **Server build only** |
| Venue search (Google Places) | Needs a key — reports unavailable without one |
| Third-party events (concerts, sports) | Needs a provider — reports unavailable |
| Payments / paid tickets | Needs Stripe — refuses to issue rather than fake |
| Email / push reminders | Needs a provider — shown in-app, not sent |
| AI phone calls | Not built (spec §31 defers it) |

Nothing in the bottom half is stubbed with fake data. Each reports what is
missing and why, in the UI.

## How it works

```
idea → intent extraction → adaptive questions → group state
                                                    ↓
                              hard constraints intersect (budget, radius, diet)
                              soft preferences converge (food, vibe, timing)
                                                    ↓
                         real places + weather + transport → ranked plan
```

**`engine/consensus.js` is the product.** It never counts votes. Hard
constraints intersect — the group's budget is the *lowest* stated ceiling, one
person's allergy binds everyone. Soft preferences converge, and the minority is
carried into the search query rather than discarded: five people want pizza and
one is vegetarian, so the query becomes *"pizza vegetarian options"* and all
seven can eat.

**`engine/questions.js` makes it adaptive without spending a cent.** Once five
of seven say pizza, the eighth person is not asked "pizza or burgers?" — they
get the pizza-shaped follow-up. Convergence is measured, not prompted.

## Layout

```
lib/        store (Redis|files) · cost governor · cache · ratelimit · ids · qr
services/   ai · places · weather · events        ← every paid call lives here
engine/     intent · catalog · questions · consensus · plan
            tickets · hosting · memory · expenses · calendar · trips · search
api/        routes.js — one router for PWA, web and any future native client
public/     waitlist site · participant flow
  app/      app.js — every screen, shared by BOTH builds
            backend-http.js — the server backend
build/      app-shell.html · backend-local.js — standalone-only pieces
database/   supabase.sql — the Postgres migration for when you outgrow Redis
docs/       COST_MODEL.md · API_INVENTORY.md
```

**One UI, two backends.** `public/app/app.js` holds every screen and never
calls `fetch` or touches the engine directly. It asks a backend, and the
backend declares what it can actually do through `caps()`. The server build
injects `backend-http.js`; the standalone build injects `backend-local.js`,
which runs the engine in the browser. A capability that is off is stated in
the UI with its reason — the app never silently hides a feature or fakes one.

## Two rules the code enforces

**1. Nothing factual is invented.** Not an address, a price, a time, or an
availability. When a provider is unconfigured or down, the UI says so. Every
dollar figure is labelled an estimate with its basis recorded. There is a test
asserting no street address appears in a plan generated without a Places key.

**2. Spending has a hard ceiling.** Every paid call is reserved against a
budget before it is made and recorded after. Hit a ceiling and the feature
degrades to the deterministic path — the app keeps working, the bill stops.
See `docs/COST_MODEL.md`.

## Storage

Backed by Upstash Redis when configured, local JSON otherwise. Every key is
prefixed `planzo:`, and `lib/store.js` **throws** if asked to touch a
`northco:` key — a leftover guard from when this shared an Upstash account
with another project; harmless to keep, since Planzo now runs on its own
account and never sees that namespace at all. There is a test for it.

`lib/store.js` is the only file that knows how data persists. Moving to
Supabase means reimplementing that one interface; `database/supabase.sql` has
the schema ready.

## Deploy

Anywhere that runs Node. On Render: root directory `planzo`, build `npm install`,
start `npm start`, then set `PLANZO_SECRET`, `PLANZO_PUBLIC_URL` and the Upstash
pair in the environment.
