<div align="center">

# KOVR SPORTS

**A premium sportsbook simulator. Real sports data, real odds, simulated money only.**

</div>

---

## What this is

KOVR is a working sportsbook — catalogue, markets, betslip, wallet, settlement —
built against a live sports data provider, with one deliberate difference: **no
real money is involved anywhere.** No payment is processed, no bank or card
detail is requested, and nothing in the wallet can be withdrawn to a real
account. The destination shown on a withdrawal is fictional on purpose.

Everything else is real. Events, competitors, start times, markets, prices and
results come from a live provider. When that provider cannot be reached, KOVR
says so rather than inventing an event, a price or a result.

KOVR is a self-contained project. It shares no code, configuration, branding,
credentials or data with anything else in this repository.

---

## Run it

```bash
cd kovr
cp .env.example .env.local     # then set KOVR_ODDS_API_KEY
npm install                     # dev tooling only — zero runtime dependencies
npm run build
npm start                       # http://127.0.0.1:4300
```

Without a key KOVR still runs; every sports surface reports
*"Live sports data temporarily unavailable"*, which is the truth.

To exercise the interface with no key and no network:

```bash
npm run dev:preview             # http://127.0.0.1:4399 — fixture data, clearly labelled
```

### Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Run the application |
| `npm run build` | Compile the server and the web client |
| `npm test` | 77 unit, integration and HTTP tests |
| `npm run typecheck` | TypeScript, both builds, no emit |
| `npm run lint` | ESLint |
| `npm run verify:live` | Call the real provider and report what came back |
| `npm run dev:preview` | Development preview on fixture data |
| `npm run clean` | Remove build output (never touches `data/`) |

---

## Configuration

All configuration is environment-based. See [`.env.example`](.env.example).

| Variable | Required | Purpose |
| --- | --- | --- |
| `KOVR_ODDS_API_KEY` | **yes** | The Odds API key. Read server-side only. |
| `KOVR_PORT` / `KOVR_HOST` | no | Listen address (default `127.0.0.1:4300`) |
| `KOVR_DB_PATH` | no | SQLite file (default `data/kovr.db`) |
| `KOVR_ODDS_REGIONS` | no | Bookmaker regions: `us`, `uk`, `eu`, `au` |
| `KOVR_ODDS_PREFERRED_BOOKMAKER` | no | Preferred book when present in a response |
| `KOVR_ODDS_HOURLY_BUDGET` | no | Hard ceiling on provider requests per hour |
| `KOVR_DEMO_STARTING_BALANCE` | no | Opening simulated balance in dollars |
| `KOVR_ADMIN_ENABLED` | no | `1` exposes `/admin`. Never enable publicly. |

**The key never leaves the server.** It is read from the environment, appended
to the provider request at the moment of the call, and scrubbed by
`redactSecrets()` from every log line, error message and HTTP response. The only
configuration shape that reaches the browser is `publicConfig()`, which reports
*whether* a key is configured and nothing more. `.env.local` is git-ignored.

---

## Architecture

```
src/
  core/        money and odds arithmetic — pure, no I/O, heavily tested
  domain/      KOVR's own data model, status rules, catalogue rules, identity
  providers/   the only code that knows a vendor's response shape
  store/       SQLite schema and repositories
  services/    refresh, sports, wallet, betting, settlement, activity
  http/        router, API, developer API, static serving
web/           the client: no framework, no build step beyond tsc
test/          unit, integration and HTTP tests (+ fixtures, clearly separated)
```

**Zero runtime dependencies.** The database is `node:sqlite`, built into Node
22 — a real relational store with foreign keys, `CHECK` constraints and
indexes, not a JSON file. The web client is plain TypeScript compiled by `tsc`.

### Swapping the data provider

Application code depends on the
[`SportsDataProvider`](src/providers/SportsDataProvider.ts) interface and on
[`src/domain/types.ts`](src/domain/types.ts) — never on a vendor's JSON.
Replacing or adding a provider means writing one new implementation of that
interface. Nothing in `services/`, `store/`, `http/` or `web/` changes.

---

## The commitments this codebase makes

These are enforced by code and covered by tests, not by convention.

**Money is integer cents.** Every amount, everywhere. `dollarsToCents` scales
through a number's shortest decimal representation, so `1.005` rounds the way
the person who typed it expects rather than the way binary floating point does.
The wallet balance is never assigned — it is only ever moved by a ledger row,
and `reconcile()` replays the ledger and compares.

**One odds engine.** Every payout in the application resolves to
`profitCents`/`payoutCents` in [`src/core/odds.ts`](src/core/odds.ts). The same
module is compiled into the browser bundle, so the number on the betslip and
the number in the ledger cannot drift apart.

**A placed bet's price is permanent.** Market refreshes write to the `odds`
table. Placed bets live in `bet_selections`, which nothing in KOVR updates. A
bet struck at -150 still reads -150 after the market has moved to -400.

**Prices are revalidated server-side.** The browser's copy of a price is
treated as a claim about what the user saw, never as the price to charge. If
the market moved, the bet is refused with a `409` carrying the movement, and
the user accepts or cancels. Nothing is silently repriced in either direction.

**A past start time settles nothing.** Status comes from the provider's scores
feed. `completed: true` is the only thing treated as final. An event that has
started but has no scores response reads `UNKNOWN` — and `UNKNOWN` does not
accept bets and does not settle.

**A result must be confirmable.** `EventResult` is constructed only when the
provider reports completion *and* publishes scores KOVR can read. A completed
event with unusable scores yields no result, leaves its bets open, and shows up
in the developer view. An unsettled bet is recoverable; a wrongly settled one
is not.

**Settlement is idempotent twice over.** `settlements.bet_id` is `UNIQUE`, and
the payout transaction carries the key `payout:<betId>`. A test runs settlement
eleven times over one winning bet and asserts exactly one payout row.

**Ungradable is a real answer.** A player prop, or a spread with no scores,
grades to `UNGRADABLE` and the bet stays open rather than being guessed either
way.

**Malformed provider records are dropped, not repaired.** A price that is not
valid American odds is discarded rather than converted. Missing data surfaces
as missing.

**Identity is never a display name.** The provider issues ids for events but
not for competitors, so KOVR derives a deterministic id from the competition
plus the exact provider-supplied name. That is a hash of an exact string, not a
fuzzy match: two similar names never collapse into one.

**Artwork resolves by id, and only when verified.** There is no name search and
no similarity match. An unresolved competitor gets a neutral monogram. Showing
no photo is a smaller failure than showing the wrong fighter, so the system is
built to fail that way round.

**Stale data is labelled.** Every sports payload carries a `Freshness` record.
Past its class threshold the interface says *"Data may be outdated — last
updated N ago"*. The service worker deliberately does not cache `/api/`
responses: stale money and stale prices are worse than an error.

**Season state is observed, not scheduled.** A league's state is derived from
the events the provider actually returns. No calendar is hard-coded, so a
competition coming into or going out of season needs no code change.

**The catalogue is discovered.** Sports, leagues and markets come from the
provider. A competition KOVR has never heard of is grouped, sorted last, and
shown — never dropped. An unrecognised market key is humanised from the key
itself and rendered. The only exclusions are non-sport groups such as politics.

---

## Testing

```bash
npm test          # 77 tests
```

Covering American-odds arithmetic against the specified reference cases, a
sweep asserting no cent is lost to rounding, ledger reconciliation, placement
validation, odds movement, insufficient funds, double submission, event status
rules, result confirmation, UFC and NFL settlement, push, void, cancellation,
repeated settlement, historical-odds immutability, provider outage and stale
data, and the HTTP surface including the `409` odds-change reply, input
validation, developer-API gating and directory-traversal refusal.

The critical end-to-end test walks the whole path: a $10,000 opening balance, a
UFC fighter backed at -150 for $100, the market moved to -240, the placed bet
still reading -150, no settlement while the start time had merely passed,
settlement on a confirmed winner, $166.67 credited, activity ordered, the
ledger reconciled to the cent, and repeated sweeps changing nothing.

Fixtures live in `test/support/` and in `scripts/dev-preview.ts`. Nothing in
`src/` imports them, and the running application never sees them.

---

## Developer tools

With `KOVR_ADMIN_ENABLED=1`, `/admin` shows provider health and quota, data
freshness, wallet reconciliation, row counts, media-asset coverage, recent
provider requests, and controls to refresh the catalogue and odds, run
settlement, clear the cache and reset the demo account. Every endpoint
re-checks the flag at request time. None of them reveals the API key.

---

## Mobile

KOVR is built mobile-first and installs as a PWA: standalone display, app icon,
maskable icons, safe-area handling for the notch and home indicator, bottom
navigation, and a betslip that is a bottom sheet on a phone and a persistent
side panel on a desktop. The shell is cached for offline launch; API responses
are not.

---

<div align="center">
<sub><strong>KOVR is a simulator.</strong> Every balance, stake and payout is a demo value.</sub>
</div>
