# Planzo — Roadmap / Backlog

Tracked across two Sep 11 feedback sessions (bug list + feature list, then
a round of real-usage fixes after live testing). See git log for the
actual changes; this file tracks status and honest gaps.

## On the "self-improving agent" idea

Still deliberately **not** building an autonomous agent that runs live
tests against production unsupervised — real budget spend, real risk of
silently breaking something between check-ins.

What that request actually became, safely: **two real automated test
suites**, both run before every deploy —
- `scripts/test.js` — 95 engine-level tests (deterministic logic: intent
  parsing, consensus, question flow, plan generation)
- `scripts/e2e.js` — 31 real HTTP-level tests against an actual running
  server (the full plan-sharing loop, and now the hosted-events/free-ticket
  loop too), no mocks

126 tests total, all passing. Same "test different scenarios, make sure
the result is exactly right" outcome the request asked for — run
on-demand by a person (or before a deploy), not by an agent making
unsupervised changes to production on its own schedule.

## Round 2 fixes (after live testing) — Sep 11

- **Concert plans asking "what day/time"** — fixed for real. Seeding a
  plan from a specific event now sets `intent.dayHint`/`timeOfDay` from
  the event's own date/time, and `consensus.js`'s `resolveDate()` was
  extended to accept a raw ISO date (an event's date) directly rather than
  only interpreting hints like "saturday". The day/timing questions are
  skipped, exactly as they should be — the event already answered them.
- **The concert itself wasn't in the generated itinerary** — `plan.js`
  now inserts the actual seeded event (title, venue, address, official
  link) as a real itinerary stop, using the data already known from
  Ticketmaster, never a generic Places search. Everything else (food,
  etc.) still fills in around it.
- **Activities moved to the main page** — was buried in Discover as
  "Something outdoors?"; now "Popular activities" lives directly on Home,
  reframed as general popular activities rather than outdoors-only, with
  season-filtered chips (confirmed correct for the current month).
- **"Add an activity" + real sign-ups** — new: anyone can add a test/real
  activity from Home, which hosts a real event server-side (public or
  link-only) and lets people claim a real free ticket inline, without
  leaving Home. Shares the same tested hosting/ticket backend as "Host an
  event" in Tickets.
- **College logos "didn't work"** — real bug, not just this sandbox:
  Clearbit's public logo API has become unreliable since their
  acquisition. Switched to Google's favicon service, which has been a
  stable public endpoint for years.
- **Dates collapsing to just "Tonight"/"Tomorrow"** — `fmtDate()` now
  always includes the real date alongside the relative label.
- **Share links not previewing richly** — `/p/<code>` and `/e/<id>` now
  get real Open Graph / Twitter Card meta tags injected server-side (the
  actual plan/event title, not a generic one) when opened via a direct
  link — verified the injected page still boots the real app correctly,
  not just the meta tags. **Render-only for now** — deliberately not
  touched on the Vercel path this round; this session hit two real Vercel
  routing regressions already from rewrites that looked safe and weren't,
  so a third speculative one wasn't worth the risk without testing against
  an actual Vercel deployment first.
- **A real generator bug, not just a code bug**: `app/scripts-port.mjs`
  (which mirrors server engine files for the browser bundle) had a
  hardcoded, stale export list for `events.js`'s hand-written adapter —
  every time the port script ran, it silently overwrote the `.d.ts` file's
  `byId`/`idFromUrl` declarations back to just `search`/`enabled`. Fixed
  the generator itself, not just the output, so this can't quietly
  regress again.

## Feature list — status (from the original "build everything" session)

1. ✅ Multi-select cuisine (up to 3)
2. ✅ Music genre gating on Discover
3. ✅ Seasonal activity rotation
4. ✅ College selector + logos (now on Google's favicon service)
5. 🟡 **Social feed** — real, not mocked (`GET /api/events/public`, now
   also surfaced right on Home). Still not filtered by school/friends —
   no follow-graph, and `state.college` isn't cross-referenced against
   events yet. Real remaining work, not a fake feature.
6. ✅ Private events + shareable ticket links
7. ✅ Working shareable plan links, verified across two separate browser
   contexts
8. ✅ Import a Ticketmaster event link
9. ✅ "What Planzo remembers" as a dropdown
10. ✅ Restaurant/activity cards with photo + $$$, same style as events
11. ✅ Activities expanded from 3 to 11, now on Home instead of Discover

## What's still genuinely open

- **Social feed filtering by school/friends** — needs a follow-graph or
  at least cross-referencing `state.college` against events.
- **Real college list** — 15 schools in `Profile.tsx` is a placeholder,
  not Ryan's actual list (never provided).
- **OG tags on Vercel** — works on Render; the Vercel serverless path
  would need its own careful, tested implementation (reading the static
  shell inside a function has real bundling gotchas) rather than
  extending the same code blind.
- **Seasons assume Northern Hemisphere / US calendar** — fine for now.
