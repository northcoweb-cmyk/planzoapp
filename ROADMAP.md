# Planzo — Roadmap / Backlog

Tracked from Ryan's Sep 11 feedback session (a bug list + a "build
everything" feature list). Bugs were fixed immediately; the full feature
list was then built the same session (see git log for both).

## On the "self-improving agent" idea

Deliberately **not** building an autonomous agent that runs live tests
against production on its own schedule — that spends real Places/AI budget
unsupervised, and could silently break something between check-ins.

What actually delivers the same value safely: a growing **regression test
suite** (`scripts/test.js`, 92 tests as of this session) that encodes every
real bad case found — like pizza-at-2am, drinks-not-food, day/date
resolution, transport always asked, dealbreaker context — and runs before
every deploy. Same "gets smarter over time" property, none of the risk of
an agent making unsupervised changes.

**Pattern going forward:** every bug fix gets a regression test alongside
it. Worth adding, when there's time: real Playwright end-to-end scenarios
(not just engine unit tests) covering the full chat → plan → generate flow.

## Feature list — status

All 11 items were built this session. What's genuinely done vs.
intentionally left thin, honestly:

1. ✅ **Multi-select cuisine (up to 3)** — `food` question capped via
   `maxPicks`, threaded through `SelectorChips`'s new `max` prop.
2. ✅ **Music genre gating** — Discover's Music tab now filters (not just
   sorts) to picked genres, same mechanism as interest filtering.
3. ✅ **Seasonal activity rotation** — `ACTIVITIES` in `Discover.tsx` now
   carries a `seasons` field; Swim/Kayak/Camp/Ski/Picnic fade in/out by month.
4. ✅ **College selector + logos** — Profile now has a college grid with real
   logos via Clearbit's logo API. Seeded with 15 major East Coast schools as
   a placeholder list — **swap in Ryan's actual list** when he sends it
   (`COLLEGES` array in `Profile.tsx`, one line per school).
5. 🟡 **Social feed** — real, not mocked: "Public events near you" in
   Tickets pulls from the live `GET /api/events/public` server endpoint.
   Honestly thin in one specific way: it's every public event, not filtered
   by school or by who you know — there's no follow-graph and the college
   field isn't cross-referenced against events yet. That's real remaining
   work, not a fake feature.
6. ✅ **Private events + shareable ticket links** — "Host an event" now
   creates a real event server-side (public or private) and issues a real,
   claimable ticket instead of a fake local one. `/e/<id>` is the actual
   landing page for the link.
7. ✅ **Working shareable plan links** — `/p/<code>` rebuilt in React
   (`ParticipantView.tsx`), verified end-to-end with two separate browser
   contexts (two different "devices"). Banner is the gradient hero card
   Ryan asked for ("look super sweet").
8. ✅ **Import event link** — pasting a Ticketmaster URL into Discover's
   search resolves that exact event via `events.byId()`. Only Ticketmaster
   is supported (matches what the app already sources events from) — "or
   other" providers wasn't scoped further since nothing else is wired up
   as an events source anywhere in the app.
9. ✅ **"What Planzo remembers" as a dropdown** — collapsed by default now.
10. ✅ **Restaurant cards with photo + $$$, same style as events** — done on
    both Discover's grid and Home's "Nearby to eat" row.
11. ✅ **Expand activities** — went from 3 to 11 (Hike, Picnic, Swim, Bike,
    Climb, Kayak, Fish, Ski, Museum, Arcade, Camp).

## Bugs fixed this session (separate from the feature list above)

- Restaurant/plan recs now exclude closed venues outright when the request
  was for "right now" (`intent.rightNow`, `plan.js` `fits()`)
- "drinks" no longer misclassified as needing a sit-down meal
- Event browsing on "For you" now actually filters to stated interests,
  not just sorts by them
- Dealbreaker question no longer offers "No drinking" when the plan is
  explicitly about nightlife/drinks
- Transport question now asked for solo plans too (previously silently
  picked bike/scooter/walk without asking anyone planning alone)
- Added a "What day do you want to do this?" question + real date
  resolution (`consensus.js` `resolveDate`), wired into weather + the
  generated plan's date — previously `plan.date` was never actually set
- Location label now reverse-geocodes to a real "City, ST" via a new
  `/api/geocode` endpoint, instead of always showing "Near you" or the
  College Park fallback
- Session identity bug: a background read (fetching the public events feed
  on tab mount) used to silently mint an anonymous "Guest" session before
  the real name was ever entered, and every action after that stayed
  attributed to "Guest" since the cached token never updated. Fixed in
  `api.ts` — a session is only created when a real name is actually used,
  and reused only when the cached one matches the name being used now.
- Past events fixed on both Home and Discover (from an earlier session)

## What's still genuinely open

- **Social feed filtering by school/friends** (item 5 above) — needs a
  follow-graph or at least cross-referencing `state.college` against
  events, neither of which exists yet.
- **Real college list** — the 15 schools in `Profile.tsx` are a reasonable
  placeholder, not Ryan's actual list (never provided in this session).
- **Seasons are Northern Hemisphere / US-calendar assumptions** — fine for
  now, worth revisiting if Planzo ever needs to work somewhere the seasons
  are flipped.
