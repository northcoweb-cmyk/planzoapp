# Planzo — Roadmap / Backlog

Tracked list of what's next, from Ryan's Sep 11 feedback session. Bugs from
that session were fixed immediately (see git log around this file's
addition); this tracks the bigger features that need a design decision
before they're safe to build, plus the "self-improving agent" ask.

## On the "self-improving agent" idea

Deliberately **not** building an autonomous agent that runs live tests
against production on its own schedule — that spends real Places/AI budget
unsupervised, and could silently break something between check-ins.

What actually delivers the same value safely: a growing **regression test
suite** (`scripts/test.js`) that encodes every real bad case we find — like
the 5 added in this session (pizza-at-2am, drinks-not-food, day/date
resolution, transport always asked, dealbreaker context) — and runs before
every deploy. Same "gets smarter over time" property, none of the risk of
an agent making unsupervised changes.

**Next step here:** as new bugs get reported, always add a regression test
alongside the fix (already the pattern going forward), and consider adding
a handful of real Playwright end-to-end scenarios (not just engine unit
tests) covering the full chat → plan → generate flow for the classic cases.

## Feature backlog (needs a design decision, not yet started)

1. **Multi-select cuisine (up to 3)** — `food` question in
   `engine/catalog.js` is currently single-select. Needs `multi: true` plus
   a cap, and `searchTerms()` in `engine/plan.js` needs to combine multiple
   cuisines into one query sensibly.
2. **Music genre gating for events** — need to ask genre preference
   (rock/house/pop/hip-hop/rap/etc.) during onboarding or in Discover, and
   filter Ticketmaster's `genre` field strictly, not just rank by it.
3. **Seasonal activity rotation** — Hike/Picnic/Swim chips in Discover
   should adapt by month/temperature (e.g. swim spots fade out once it's
   cold). Needs a season→activity-set mapping.
4. **College selector + logos** — needs Ryan's actual college list and a
   logo asset per school (or a logo API/CDN) before this can start.
5. **Social feed** — other users' public events + school-linked events.
   This is a real product surface (needs a backend data model for
   posts/visibility, not just a UI addition) — biggest item on this list.
6. **Private events with shareable ticket links** — builds on top of the
   existing `engine/tickets.js` state machine, which already exists and is
   tested; needs a "create private event" flow and a real link/QR share UI.
7. **Working shareable plan links** — `/p/<code>` participant flow exists
   server-side (`server/routes.js`) but was deleted from `public/` during
   the NorthCo separation cleanup along with the old vanilla PWA. Needs a
   React version of the participant view rebuilt in `app/src/`, plus a
   polished share-banner design (Ryan asked for this to "look super sweet").
8. **Importing someone else's event link** — paste a Ticketmaster (or other)
   event URL and have Planzo resolve it into a plan seed. Needs a URL
   parser per supported provider.
9. **"What Planzo Remembers" as a collapsible dropdown** — small, contained
   UI change wherever that section currently renders (Profile/Plans).
10. **Restaurant cards with photo + $$$ styling on the main Discover grid**
    (not the current separate list-style row) — visual/layout change to
    `VenueCard` in `Discover.tsx`.
11. **Expand activities beyond Hike/Picnic/Swim** — more categories
    (climbing, biking, museums, arcades, etc.), same pattern as the
    current `ACTIVITIES` map in `Discover.tsx`.

## Fixed this session (Sep 11)

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
- Past events fixed on both Home and Discover (from an earlier session)
