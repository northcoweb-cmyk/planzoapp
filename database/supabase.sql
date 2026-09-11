create extension if not exists "citext";
-- ─────────────────────────────────────────────────────────────────────
-- PLANZO — Postgres / Supabase schema
--
-- Not required to run Planzo today (lib/store.js uses Redis or files).
-- This is the migration for when real usage justifies Postgres, RLS and
-- realtime. The shapes match the objects the engine already produces, so
-- the swap is confined to lib/store.js.
-- ─────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── ACCOUNTS ─────────────────────────────────────────────────────────
create table users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique,                        -- auth.users.id
  name          text not null,
  email         citext unique,
  phone         text,
  photo_url     text,
  college       text,
  birthday      date,
  home_lat      double precision,
  home_lon      double precision,
  settings      jsonb not null default '{}',
  subscription  text not null default 'free' check (subscription in ('free','pro')),
  created_at    timestamptz not null default now()
);

-- Anonymous link participants. Deliberately NOT a user account.
create table participants (
  id            uuid primary key default gen_random_uuid(),
  display_name  text not null,
  photo_url     text,
  session_hash  text not null unique,               -- HMAC, never the raw token
  user_id       uuid references users(id) on delete set null,  -- claimed later
  created_at    timestamptz not null default now()
);

-- ── GROUPS ───────────────────────────────────────────────────────────
create table groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table group_members (
  group_id  uuid references groups(id) on delete cascade,
  user_id   uuid references users(id) on delete cascade,
  role      text not null default 'member',
  primary key (group_id, user_id)
);

-- ── PLANS ────────────────────────────────────────────────────────────
create table plans (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,               -- opaque share code, never the pk
  creator_id    uuid not null references participants(id) on delete cascade,
  group_id      uuid references groups(id) on delete set null,
  title         text,
  idea          text not null,
  intent        jsonb not null default '{}',
  plan_date     date,
  origin_lat    double precision,
  origin_lon    double precision,
  origin_label  text,
  visibility    text not null default 'private' check (visibility in ('private','link','public')),
  status        text not null default 'collecting' check (status in ('collecting','planned','confirmed','done','cancelled')),
  final_plan    jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on plans (creator_id);
create index on plans (code);

create table plan_participants (
  plan_id         uuid references plans(id) on delete cascade,
  participant_id  uuid references participants(id) on delete cascade,
  is_creator      boolean not null default false,
  answers         jsonb not null default '{}',
  confirmation    text not null default 'invited'
                  check (confirmation in ('invited','opened','responded','confirmed','maybe','declined')),
  joined_at       timestamptz not null default now(),
  answered_at     timestamptz,
  primary key (plan_id, participant_id)
);

-- ── MEMORY (spec §15/§21 — scoped and confidence-weighted, never a transcript)
create table memories (
  id               uuid primary key default gen_random_uuid(),
  subject_type     text not null check (subject_type in ('user','group')),
  subject_id       uuid not null,
  category         text not null,                   -- activity | food | budget | transport | ...
  value            text not null,
  stability        text not null check (stability in ('stable','habit','temporary')),
  source           text not null check (source in ('explicit','inferred')),
  confidence       real not null default 0.5 check (confidence between 0 and 1),
  plan_id          uuid references plans(id) on delete cascade,  -- set ⇒ temporary scope
  created_at       timestamptz not null default now(),
  last_confirmed_at timestamptz,
  expires_at       timestamptz
);
create index on memories (subject_type, subject_id, category);
-- Temporary context must never overwrite a stable preference (spec §15).
create index on memories (stability) where stability <> 'temporary';

-- ── EXTERNAL DATA — every fact carries its provenance (spec §48) ──────
create table external_places (
  provider        text not null,
  provider_id     text not null,
  name            text not null,
  address         text,
  lat             double precision,
  lon             double precision,
  payload         jsonb not null,
  fetched_at      timestamptz not null default now(),
  expires_at      timestamptz,
  primary key (provider, provider_id)
);

create table external_events (
  provider     text not null,
  provider_id  text not null,
  title        text not null,
  venue        text,
  address      text,
  starts_at    timestamptz,
  ends_at      timestamptz,
  price_min    numeric(10,2),
  price_max    numeric(10,2),
  official_url text,
  payload      jsonb not null,
  fetched_at   timestamptz not null default now(),
  primary key (provider, provider_id)
);

-- ── EVENTS + TICKETS ─────────────────────────────────────────────────
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  logo_url    text,
  description text,
  verified    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table organization_members (
  org_id   uuid references organizations(id) on delete cascade,
  user_id  uuid references users(id) on delete cascade,
  role     text not null check (role in ('owner','admin','event_manager','moderator','member')),
  primary key (org_id, user_id)
);

create table events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) on delete cascade,
  owner_id    uuid not null references users(id) on delete cascade,
  title       text not null,
  description text,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  venue       text,
  address     text,
  capacity    integer,
  visibility  text not null default 'private' check (visibility in ('private','link','public')),
  hero_url    text,
  created_at  timestamptz not null default now()
);

create table event_staff (
  event_id  uuid references events(id) on delete cascade,
  user_id   uuid references users(id) on delete cascade,
  role      text not null check (role in ('admin','check_in')),
  primary key (event_id, user_id)
);

create table ticket_types (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  name       text not null,
  price      numeric(10,2) not null default 0,
  quantity   integer
);

create table tickets (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references events(id) on delete cascade,
  ticket_type_id    uuid references ticket_types(id) on delete set null,
  attendee_id       uuid references participants(id) on delete set null,
  attendee_name     text not null,
  secure_token_hash text not null unique,           -- HMAC only; raw token never stored
  status            text not null default 'ACTIVE'
                    check (status in ('CREATED','ACTIVE','TRANSFERRED','CANCELLED','REFUNDED','CHECKED_IN','INVALIDATED')),
  issued_at         timestamptz not null default now(),
  checked_in_at     timestamptz,
  transferred_at    timestamptz,
  invalidated_at    timestamptz
);
create index on tickets (event_id, status);

create table check_ins (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references tickets(id) on delete cascade,
  event_id       uuid not null references events(id) on delete cascade,
  staff_user_id  uuid references users(id) on delete set null,
  checked_in_at  timestamptz not null default now()
);

-- THE duplicate-admission guarantee (spec §61). One successful check-in per
-- ticket, enforced by the database rather than by application logic.
create unique index check_ins_one_per_ticket on check_ins (ticket_id);

-- The atomic check-in, for reference. SELECT ... FOR UPDATE serialises
-- concurrent scanners; the unique index above is the backstop.
create or replace function check_in_ticket(p_credential_hash text, p_event_id uuid, p_staff uuid)
returns table (result text, attendee_name text, checked_in_at timestamptz)
language plpgsql as $$
declare t tickets%rowtype;
begin
  select * into t from tickets where secure_token_hash = p_credential_hash for update;
  if not found                     then return query select 'INVALID_TICKET', null::text, null::timestamptz; return; end if;
  if t.event_id <> p_event_id      then return query select 'INVALID_EVENT', null::text, null::timestamptz; return; end if;
  if t.status = 'CHECKED_IN'       then return query select 'ALREADY_USED', t.attendee_name, t.checked_in_at; return; end if;
  if t.status in ('CANCELLED','REFUNDED') then return query select 'TICKET_CANCELLED', null::text, null::timestamptz; return; end if;
  if t.status <> 'ACTIVE'          then return query select 'INVALID_TICKET', null::text, null::timestamptz; return; end if;

  update tickets set status = 'CHECKED_IN', checked_in_at = now() where id = t.id;
  insert into check_ins (ticket_id, event_id, staff_user_id) values (t.id, p_event_id, p_staff);
  return query select 'ENTRY_GRANTED', t.attendee_name, now();
end $$;

-- ── WAITLIST ─────────────────────────────────────────────────────────
create table waitlist_signups (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  email            citext not null unique,          -- normalized ⇒ no duplicates
  phone            text,
  college          text,
  city             text,
  use_case         text,
  source           text,
  referral_code    text,
  position         integer,
  status           text not null default 'pending',
  marketing_opt_in boolean not null default true,
  launch_notified  boolean not null default false,
  metadata         jsonb not null default '{}',
  created_at       timestamptz not null default now()
);

-- ── OPS ──────────────────────────────────────────────────────────────
create table api_spend (
  id         bigserial primary key,
  service    text not null,
  usd        numeric(12,6) not null,
  plan_id    uuid references plans(id) on delete set null,
  detail     text,
  created_at timestamptz not null default now()
);
create index on api_spend (service, created_at);

create table audit_logs (
  id         bigserial primary key,
  actor_id   uuid,
  action     text not null,
  subject    text not null,
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────
alter table users              enable row level security;
alter table plans              enable row level security;
alter table plan_participants  enable row level security;
alter table tickets            enable row level security;
alter table check_ins          enable row level security;
alter table memories           enable row level security;
alter table waitlist_signups   enable row level security;

create policy "own profile" on users
  for all using (auth_user_id = auth.uid());

-- A plan is visible to its participants, and to anyone if it is public.
create policy "plan visible to participants" on plans
  for select using (
    visibility = 'public'
    or exists (
      select 1 from plan_participants pp
      join participants pa on pa.id = pp.participant_id
      where pp.plan_id = plans.id and pa.user_id = (select id from users where auth_user_id = auth.uid())
    )
  );

-- An attendee sees their own ticket. Never anyone else's.
create policy "own ticket" on tickets
  for select using (
    attendee_id in (select id from participants where user_id = (select id from users where auth_user_id = auth.uid()))
  );

-- Only event staff may write a check-in, and only for their own event.
create policy "staff check in" on check_ins
  for insert with check (
    exists (
      select 1 from event_staff es
      join users u on u.id = es.user_id
      where es.event_id = check_ins.event_id and u.auth_user_id = auth.uid()
    )
    or exists (
      select 1 from events e join users u on u.id = e.owner_id
      where e.id = check_ins.event_id and u.auth_user_id = auth.uid()
    )
  );

-- Waitlist: anyone may join, nobody may read. Export via the service role.
create policy "anyone can join waitlist" on waitlist_signups for insert with check (true);
