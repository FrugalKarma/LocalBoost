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
-- Make yourself the admin: sign up in the app first, then run this line with your email.
--   update public.profiles set role = 'admin' where email = 'you@example.com';
