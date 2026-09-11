# Planzo — Cost Model & Cash Control

The question this document answers: **what does one plan cost, and what is the
worst thing that can happen to the bill?**

---

## 1. What a plan actually costs today

A "plan" is one group deciding one thing: idea entered, link shared, 3–8 people
answer, final plan generated.

| Component | Calls per plan | Unit cost | Cost per plan |
|---|---|---|---|
| Adaptive questions (all of them) | ~25 | $0 | **$0.00** |
| Consensus / hard-constraint resolution | every answer | $0 | **$0.00** |
| Candidate ranking + itinerary + costing | 1 | $0 | **$0.00** |
| Weather (Open-Meteo) | 1 | $0 | **$0.00** |
| Intent parsing — deterministic path | 1 | $0 | **$0.00** |
| Intent parsing — AI fallback (~20% of plans, cached 14d) | 0.2 | ~$0.0004 | **$0.0001** |
| Places text search (1 per slot, cached 12h and shared) | 1–2 | $0.032 | **$0.032–0.064** |
| Redis reads/writes | ~40 | free tier | **$0.00** |

### Cost per completed plan

| Configuration | Per plan | 1,000 plans/mo |
|---|---|---|
| **No API keys at all** (ships today) | **$0.000** | **$0** |
| Weather only | $0.000 | $0 |
| Weather + AI intent | ~$0.0001 | ~$0.10 |
| **Weather + AI + Places (full product)** | **~$0.05** | **~$50** |

The decisive fact: **the decision engine — the thing that makes Planzo a
product — costs nothing per plan.** It is rules, not tokens. AI is a garnish on
intent parsing and Places is the only line item with real volume risk.

### What this means for the business

At 1,000 plans/month with everything switched on, infrastructure is ~$50.
One Planzo Pro subscriber at $4.99 covers ~100 plans. You need roughly
**10 paying subscribers per 1,000 monthly plans** to break even on data costs.
That is a workable ratio. It is workable *because* the engine is deterministic.

If the planning engine had been built as "send everything to an LLM and show
the answer," a single plan with 7 participants and 25 adaptive questions would
run 25+ model calls at ~$0.01–0.05 each: **$0.25–$1.25 per plan**, 5–25× the
current cost, with worse latency and no way to guarantee a consistent answer.
That architecture is what kills consumer AI startups. This one avoids it by
construction, not by discipline.

---

## 2. The kill switch

Every metered call passes through `lib/cost.js` before it is made.

```
caller → cost.reserve(service, estimate)
           ├── over monthly ceiling? → {ok:false}  → caller degrades gracefully
           ├── over daily ceiling?   → {ok:false}  → caller degrades gracefully
           ├── over per-plan ceiling?→ {ok:false}  → caller degrades gracefully
           └── ok → make the call → cost.record(actual)
```

Three ceilings, all hard, all set in env:

| Ceiling | Default | Why it exists |
|---|---|---|
| `PLANZO_AI_PER_PLAN_USD` | $0.05 | One abusive plan cannot eat the day |
| `PLANZO_AI_DAILY_USD` | $1.00 | A bug in a loop costs $1, not $500 |
| `PLANZO_AI_MONTHLY_USD` | $20.00 | The absolute monthly exposure |
| `PLANZO_PLACES_DAILY_USD` | $2.00 | Same, for the expensive API |
| `PLANZO_PLACES_MONTHLY_USD` | $40.00 | |

**Worst case with the defaults: $60/month, total, across every user.**
Not "should be around" — cannot exceed, because the reserve happens before
the call and the ledger is atomic.

### When a ceiling is hit

The app does not break. It degrades:

- **AI blocked** → the deterministic parser handles the idea. Users notice nothing.
- **Places blocked** → the plan is still generated with times, transport and
  budget, and it says plainly: *"Venue search hit today's spending limit."*
  It does not invent a restaurant to fill the gap.

Nothing retries past a ceiling. Nothing queues up to spend the moment the day
rolls over. It just stops.

### Why this specific design

A prior project's AI credits went dry in days because calls were made
automatically, on page load, uncached, for work that didn't warrant them. Each
of those four is addressed structurally here:

| That failure mode | Planzo's structural answer |
|---|---|
| Automatic/scheduled calls | Every AI call originates in a user action |
| Uncached regeneration on load | `lib/cache.js` — TTL + in-flight dedupe |
| Called for low-value work | Deterministic path handles ~80% of intents |
| No ceiling | Three hard ceilings, checked pre-flight |

---

## 3. Cost-control mechanisms in the code

**Caching with real TTLs** (`lib/cache.js`)
Freshness per data class, per spec §49: weather 30 min, place search 12 h,
place details 7 days, AI intent 14 days. Dynamic data is never cached
indefinitely; static data is never re-fetched needlessly.

**In-flight deduplication**
Seven friends open the same plan link simultaneously → one Places query, not
seven. This alone is roughly a 7× saving on the most expensive API at the exact
moment of peak load.

**Search sharing across a group**
One text search per plan *slot*, not per participant. The result is cached
against the query + rounded coordinates, so two different groups planning
dinner in the same area share the same paid lookup.

**Minimal field masks**
Google bills by requested field. `SEARCH_FIELDS` and `DETAIL_FIELDS` in
`services/places.js` request only what is rendered. Details is fetched only for
shortlisted places, never for a whole result page.

**Model tiering**
Cheap model by default; the expensive one must be asked for explicitly by name.
No call can silently escalate to an expensive model.

**Pre-flight worst-case estimation**
The reserve assumes the full output token allowance is used. A call is never
approved whose *worst case* would breach a ceiling.

**Rate limiting** (`lib/ratelimit.js`)
Plan creation, AI, waitlist, check-in and reminders are all bucketed per IP.
An abuser hits a 429 long before they hit your wallet.

---

## 4. Monitoring

```
GET /api/admin/cost?key=<PLANZO_ADMIN_KEY>
```

Returns per service: today's spend, this month's spend, remaining headroom,
whether it is currently blocked, and the last 300 individual charges with the
plan each belongs to.

The same figures appear in the app under **You → Spend today**, with a bar per
service, so you see it without opening a terminal.

---

## 5. Scaling forecast

| Monthly plans | Places | AI | Total |
|---|---|---|---|
| 100 | $3 | $0.01 | **~$3** |
| 1,000 | $50 | $0.10 | **~$50** |
| 10,000 | $500* | $1 | **~$500*** |
| 100,000 | $5,000* | $10 | **~$5,000*** |

\* Before the $200/month Google Maps credit and before volume discounts. At
10k plans/month the cache hit rate should be well above 60% (groups cluster in
the same campus areas), so the realistic figure is materially lower.

**The decision point is ~10,000 plans/month.** Below it, run as-is. Above it,
the options in order of value: raise cache TTLs on place search, pre-warm a
venue index for your top campus areas (turning per-plan cost into fixed cost),
or negotiate Maps pricing. None requires rearchitecting.

---

## 6. What is deliberately NOT built

Not building these is a cost decision, not an oversight:

- **No event provider.** Every option costs money or requires a partnership.
  `services/events.js` reports unavailable until you sign one.
- **No live rideshare pricing.** Uber/Lyft do not expose fare APIs at this tier.
  Estimated ranges are shown and labelled as estimates.
- **No Stripe yet.** Zero revenue means zero reason to carry a payments
  integration. The subscription surface is present; the processor is not.
- **No SMS.** Twilio is per-message forever. Email and push cover reminders.
- **No AI phone calls.** Per spec §31, explicitly future work.

Each is a documented switch, not a missing feature.
