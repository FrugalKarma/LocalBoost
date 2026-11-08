-- LocalBoost accounts: run this once in Supabase → SQL Editor → New query → Run.
-- The browser never talks to these tables. Only the LocalBoost server (with the secret key) does,
-- so row-level security is switched on with no policies: nobody else can read or write a row.

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  role        text not null default 'client' check (role in ('client', 'admin')),
  disabled    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.businesses (
  owner       uuid primary key references public.profiles (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  name        text,
  category    text,
  city        text,
  stage       text,
  version     bigint not null default 1,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
revoke all on public.profiles, public.businesses from anon, authenticated;
grant select, insert, update, delete on public.profiles, public.businesses to service_role;

-- Every new sign-up gets a profile row (role 'client').
create or replace function public.localboost_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, '')) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists localboost_on_auth_user_created on auth.users;
create trigger localboost_on_auth_user_created
  after insert on auth.users for each row execute function public.localboost_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Hosted websites (/s/<slug>), the booking requests they receive, and daily visit counts.
create table if not exists public.sites (
  owner       uuid primary key references public.profiles (id) on delete cascade,
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  doc         jsonb not null,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.site_requests (
  id          bigint generated always as identity primary key,
  owner       uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  name        text not null,
  contact     text not null,
  date        date,
  time        text,
  party       int,
  message     text,
  status      text not null default 'new' check (status in ('new', 'done'))
);
create index if not exists site_requests_owner on public.site_requests (owner, created_at desc);

create table if not exists public.site_stats (
  owner     uuid not null references public.profiles (id) on delete cascade,
  day       date not null,
  views     int not null default 0,
  clicks    int not null default 0,
  requests  int not null default 0,
  primary key (owner, day)
);

alter table public.sites enable row level security;
alter table public.site_requests enable row level security;
alter table public.site_stats enable row level security;
revoke all on public.sites, public.site_requests, public.site_stats from anon, authenticated;
grant select, insert, update, delete on public.sites, public.site_requests, public.site_stats to service_role;

-- one call per visit / click / request: adds 1 to today's counter
create or replace function public.localboost_site_hit(p_owner uuid, p_day date, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.site_stats (owner, day, views, clicks, requests)
  values (p_owner, p_day, (p_kind = 'view')::int, (p_kind = 'click')::int, (p_kind = 'request')::int)
  on conflict (owner, day) do update set
    views = site_stats.views + excluded.views,
    clicks = site_stats.clicks + excluded.clicks,
    requests = site_stats.requests + excluded.requests;
end $$;
revoke all on function public.localboost_site_hit(uuid, date, text) from public, anon, authenticated;
grant execute on function public.localboost_site_hit(uuid, date, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Plans (set by the admin in the app until payments are switched on) and the free monthly AI allowance.
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists ai_month text;
alter table public.profiles add column if not exists ai_count int not null default 0;
do $$ begin
  alter table public.profiles add constraint profiles_plan_check check (plan in ('free', 'pro', 'business'));
exception when duplicate_object then null; end $$;
-- Bank-transfer upgrades: the plan a client asked to pay for, until the admin sees the money and switches the plan.
alter table public.profiles add column if not exists plan_request text check (plan_request in ('pro', 'business'));
alter table public.profiles add column if not exists plan_request_at timestamptz;
-- Weekly email digest: true once the client unsubscribes.
alter table public.profiles add column if not exists digest_off boolean not null default false;

-- Photos for the websites (logo, cover, gallery). Public to read, only the server can write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Make yourself the admin: sign up in the app first, then run this line with your email.
--   update public.profiles set role = 'admin' where email = 'you@example.com';

-- Record of accepted Terms / Privacy / AI notice (version = date of the texts). Safe to rerun.
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
-- Fair-use limits per client: Google lookups per month, AI requests per day (lib/auth-core.mjs LIMITS).
alter table public.profiles add column if not exists places_month text;
alter table public.profiles add column if not exists places_count int not null default 0;
alter table public.profiles add column if not exists ai_day text;
alter table public.profiles add column if not exists ai_day_count int not null default 0;
