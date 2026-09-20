-- KOVR Sports — schema.
--
-- Every monetary column is an INTEGER number of cents. Every table that
-- records money carries CHECK constraints, because an accounting bug that
-- only shows up in the UI is an accounting bug that shipped.
--
-- All balances are simulated. KOVR holds no real funds.

PRAGMA foreign_keys = ON;

/* ─────────────────────────────── people ─────────────────────────────── */

CREATE TABLE IF NOT EXISTS profiles (
  id               TEXT PRIMARY KEY,
  username         TEXT NOT NULL UNIQUE,
  email            TEXT NOT NULL UNIQUE,
  display_name     TEXT NOT NULL,
  avatar_initials  TEXT NOT NULL,
  is_demo          INTEGER NOT NULL DEFAULT 1 CHECK (is_demo IN (0, 1)),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallets (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  -- A simulated wallet may never go negative; the bet engine debits only
  -- after checking, and this constraint is the backstop.
  balance_cents  INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  currency       TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

/* ───────────────────────────── sports data ──────────────────────────── */

CREATE TABLE IF NOT EXISTS sport_categories (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  priority  INTEGER NOT NULL DEFAULT 50,
  icon      TEXT NOT NULL DEFAULT 'generic'
);

CREATE TABLE IF NOT EXISTS leagues (
  id                    TEXT PRIMARY KEY,
  provider_key          TEXT NOT NULL UNIQUE,
  category_id           TEXT NOT NULL REFERENCES sport_categories(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  short_name            TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  priority              INTEGER NOT NULL DEFAULT 900,
  provider_active       INTEGER NOT NULL DEFAULT 1 CHECK (provider_active IN (0, 1)),
  outrights_only        INTEGER NOT NULL DEFAULT 0 CHECK (outrights_only IN (0, 1)),
  season_state          TEXT NOT NULL DEFAULT 'UNKNOWN',
  live_event_count      INTEGER NOT NULL DEFAULT 0,
  upcoming_event_count  INTEGER NOT NULL DEFAULT 0,
  last_synced_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_leagues_category ON leagues(category_id, priority);

CREATE TABLE IF NOT EXISTS events (
  id                        TEXT PRIMARY KEY,
  provider_event_id         TEXT NOT NULL UNIQUE,
  league_id                 TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  category_id               TEXT NOT NULL REFERENCES sport_categories(id) ON DELETE CASCADE,
  provider_league_key       TEXT NOT NULL,
  name                      TEXT NOT NULL,
  event_title               TEXT,
  start_time                TEXT NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'UNKNOWN'
                              CHECK (status IN ('UPCOMING','LIVE','PAUSED','FINAL','CANCELLED','POSTPONED','UNKNOWN')),
  period_label              TEXT,
  venue                     TEXT,
  image_url                 TEXT,

  -- Result columns stay NULL until the provider confirms completion. The
  -- settlement engine refuses to grade an event whose confirmed_at is NULL.
  result_winner_external_id TEXT,
  result_is_draw            INTEGER CHECK (result_is_draw IN (0, 1)),
  result_confirmed_at       TEXT,
  result_method             TEXT,
  result_scores_json        TEXT,

  -- Combat-sports detail; NULL for every other sport.
  fight_weight_class        TEXT,
  fight_is_main_event       INTEGER CHECK (fight_is_main_event IN (0, 1)),
  fight_card_segment        TEXT CHECK (fight_card_segment IN ('MAIN','PRELIM','EARLY_PRELIM')),
  fight_scheduled_rounds    INTEGER,
  fight_method              TEXT,
  fight_end_round           INTEGER,
  fight_end_time            TEXT,

  last_updated_at           TEXT NOT NULL,
  created_at                TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_start        ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_league_start ON events(league_id, start_time);
CREATE INDEX IF NOT EXISTS idx_events_status_start ON events(status, start_time);
CREATE INDEX IF NOT EXISTS idx_events_category     ON events(category_id, start_time);

CREATE TABLE IF NOT EXISTS participants (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- The provider's stable id, or a deterministic id derived from league and
  -- canonical name. Identity is never the display name alone.
  external_id  TEXT NOT NULL,
  name         TEXT NOT NULL,
  abbreviation TEXT,
  role         TEXT NOT NULL CHECK (role IN ('HOME','AWAY','NEUTRAL')),
  score        INTEGER,
  position     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (event_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_external ON participants(external_id);

CREATE TABLE IF NOT EXISTS markets (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id         TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  key              TEXT NOT NULL,
  name             TEXT NOT NULL,
  kind             TEXT NOT NULL,
  priority         INTEGER NOT NULL DEFAULT 100,
  last_updated_at  TEXT NOT NULL,
  UNIQUE (event_id, key)
);

CREATE TABLE IF NOT EXISTS odds (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id               INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  event_id                TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  selection_id            TEXT NOT NULL,
  selection_name          TEXT NOT NULL,
  participant_external_id TEXT,
  line                    REAL,
  -- American odds: never zero, never inside (-100, 100).
  price_american          INTEGER NOT NULL CHECK (abs(price_american) >= 100),
  bookmaker_key           TEXT NOT NULL,
  bookmaker_name          TEXT NOT NULL,
  price_updated_at        TEXT NOT NULL,
  fetched_at              TEXT NOT NULL,
  UNIQUE (market_id, selection_id)
);

CREATE INDEX IF NOT EXISTS idx_odds_event ON odds(event_id);

-- Append-only price history. Written whenever an observed price differs from
-- the one already stored, so a market move is auditable after the fact.
CREATE TABLE IF NOT EXISTS odds_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id        TEXT NOT NULL,
  market_key      TEXT NOT NULL,
  selection_id    TEXT NOT NULL,
  price_american  INTEGER NOT NULL CHECK (abs(price_american) >= 100),
  bookmaker_key   TEXT NOT NULL,
  observed_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_lookup ON odds_snapshots(event_id, market_key, selection_id, observed_at);

/* ────────────────────────────── betting ─────────────────────────────── */

CREATE TABLE IF NOT EXISTS bets (
  id                      TEXT PRIMARY KEY,
  user_id                 TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_id               TEXT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  stake_cents             INTEGER NOT NULL CHECK (stake_cents > 0),
  price_american          INTEGER NOT NULL CHECK (abs(price_american) >= 100),
  potential_payout_cents  INTEGER NOT NULL CHECK (potential_payout_cents > 0),
  status                  TEXT NOT NULL DEFAULT 'OPEN'
                            CHECK (status IN ('OPEN','WON','LOST','PUSH','VOID','CANCELLED')),
  payout_cents            INTEGER CHECK (payout_cents IS NULL OR payout_cents >= 0),
  placed_at               TEXT NOT NULL,
  settled_at              TEXT,
  -- A settled bet must carry a settlement timestamp, and an open one must not.
  CHECK ((status = 'OPEN' AND settled_at IS NULL) OR (status <> 'OPEN' AND settled_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_bets_user_status ON bets(user_id, status, placed_at DESC);

CREATE TABLE IF NOT EXISTS bet_selections (
  id                      TEXT PRIMARY KEY,
  bet_id                  TEXT NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  event_id                TEXT NOT NULL,
  provider_event_id       TEXT NOT NULL,
  league_id               TEXT NOT NULL,
  -- Denormalised on purpose: a bet must render identically for ever, even
  -- after the event row is pruned or the competition is renamed.
  event_name              TEXT NOT NULL,
  event_start_time        TEXT NOT NULL,
  market_key              TEXT NOT NULL,
  market_name             TEXT NOT NULL,
  selection_id            TEXT NOT NULL,
  selection_name          TEXT NOT NULL,
  participant_external_id TEXT,
  line                    REAL,
  -- IMMUTABLE. The price accepted at placement. Nothing in KOVR updates this
  -- column; a later market move creates new odds rows, never a rewrite here.
  price_american          INTEGER NOT NULL CHECK (abs(price_american) >= 100),
  bookmaker_key           TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'OPEN'
                            CHECK (status IN ('OPEN','WON','LOST','PUSH','VOID','CANCELLED')),
  settled_at              TEXT
);

CREATE INDEX IF NOT EXISTS idx_bet_selections_bet   ON bet_selections(bet_id);
CREATE INDEX IF NOT EXISTS idx_bet_selections_event ON bet_selections(event_id, status);

-- One row per settled bet. The UNIQUE constraint on bet_id is what makes
-- settlement idempotent: a second attempt raises rather than paying twice.
CREATE TABLE IF NOT EXISTS settlements (
  id                   TEXT PRIMARY KEY,
  bet_id               TEXT NOT NULL UNIQUE REFERENCES bets(id) ON DELETE CASCADE,
  event_id             TEXT NOT NULL,
  outcome              TEXT NOT NULL CHECK (outcome IN ('WON','LOST','PUSH','VOID','CANCELLED')),
  payout_cents         INTEGER NOT NULL CHECK (payout_cents >= 0),
  result_source        TEXT NOT NULL,
  result_confirmed_at  TEXT NOT NULL,
  created_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                   TEXT PRIMARY KEY,
  wallet_id            TEXT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL CHECK (type IN (
                         'DEMO_INITIAL_BALANCE','DEMO_DEPOSIT','BET_PLACED',
                         'BET_PAYOUT','BET_REFUND','DEMO_WITHDRAWAL')),
  -- Signed. Credits positive, debits negative. Never zero.
  amount_cents         INTEGER NOT NULL CHECK (amount_cents <> 0),
  balance_after_cents  INTEGER NOT NULL CHECK (balance_after_cents >= 0),
  description          TEXT NOT NULL,
  bet_id               TEXT REFERENCES bets(id) ON DELETE SET NULL,
  -- Second line of defence against a double credit: settlement writes a key
  -- of the form "payout:<betId>", which can exist at most once.
  idempotency_key      TEXT UNIQUE,
  created_at           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON wallet_transactions(wallet_id, created_at DESC);

/* ─────────────────────────────── media ──────────────────────────────── */

-- Verified image mappings, keyed by stable entity id. KOVR resolves artwork
-- through this table so a fighter photo can never be attached to the wrong
-- fighter by a name that merely looks similar.
CREATE TABLE IF NOT EXISTS media_assets (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type      TEXT NOT NULL CHECK (entity_type IN ('PARTICIPANT','LEAGUE','CATEGORY','EVENT')),
  entity_id        TEXT NOT NULL,
  entity_name      TEXT NOT NULL,
  image_url        TEXT,
  source           TEXT NOT NULL,
  verified         INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  last_verified_at TEXT,
  created_at       TEXT NOT NULL,
  UNIQUE (entity_type, entity_id)
);

/* ───────────────────────── provider bookkeeping ─────────────────────── */

CREATE TABLE IF NOT EXISTS provider_cache (
  cache_key   TEXT PRIMARY KEY,
  payload     TEXT NOT NULL,
  fetched_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

-- Every provider call is logged so the refresh manager can hold itself to the
-- configured hourly budget and the admin surface can show what happened.
CREATE TABLE IF NOT EXISTS provider_requests (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint         TEXT NOT NULL,
  requested_at     TEXT NOT NULL,
  duration_ms      INTEGER,
  http_status      INTEGER,
  ok               INTEGER NOT NULL CHECK (ok IN (0, 1)),
  error            TEXT,
  quota_remaining  INTEGER,
  quota_used       INTEGER
);

CREATE INDEX IF NOT EXISTS idx_provider_requests_time ON provider_requests(requested_at DESC);

CREATE TABLE IF NOT EXISTS app_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
