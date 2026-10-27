-- Phase 1: identity and rooms (the co-op MVP).
-- Source of truth for the schema. replica/schema.sql is the planning draft this grew from.
-- Written for Supabase: uses auth.users and auth.uid(). Times are timestamptz (UTC).
--
-- Access model: row level security on every table. Clients get SELECT where a policy allows it
-- and nothing else on rooms and room_members. Every write goes through the security definer
-- functions below, which read the caller from auth.uid().

create extension if not exists citext;

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------------------------
-- profiles. id equals auth.users.id: one row per auth user, guests included.
-- ---------------------------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 30),
  avatar text not null default 'default',
  locale text not null default 'en',
  timezone text not null default 'UTC',          -- used to cut the "day" for streaks
  is_guest boolean not null default true,        -- true until an email/Google identity is linked
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on profiles
  for each row execute function set_updated_at();

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- The last 12 hex digits of a v4 uuid are random: 'artist_' + 12 = 19 characters, so the
  -- username stays inside the 20 allowed and two users colliding is a 1 in 2^48 event.
  hex text := right(replace(new.id::text, '-', ''), 12);
begin
  insert into profiles (id, username, display_name, is_guest)
  values (new.id, 'artist_' || hex, 'Artist ' || upper(substr(hex, 1, 4)),
          coalesce(new.is_anonymous, true));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- rooms and room_members
-- ---------------------------------------------------------------------------------------------
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),  -- 32-char alphabet, no 0/O/1/I
  host_id uuid not null references profiles(id) on delete cascade,
  mode text not null default 'friends' check (mode in ('friends','live','quick')),
  lesson_slug text check (lesson_slug ~ '^[a-z0-9-]{1,64}$'),   -- null = free canvas
  capacity smallint not null default 2 check (capacity between 2 and 10),
  status text not null default 'open' check (status in ('open','active','ended','expired')),
  expires_at timestamptz not null default now() + interval '24 hours',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- A code is unique only while its room is live, so a code can be reused after the room ends.
-- Anything keyed by a room (the Durable Object, artworks) must therefore use rooms.id, not code.
create unique index rooms_live_code_uniq on rooms (code) where status in ('open','active');
create index rooms_host_idx on rooms (host_id);
create index rooms_expiry_idx on rooms (status, expires_at);
create trigger rooms_updated before update on rooms
  for each row execute function set_updated_at();

create table room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'guest' check (role in ('host','guest')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, user_id)
);
create index room_members_user_idx on room_members (user_id);
create trigger room_members_updated before update on room_members
  for each row execute function set_updated_at();

-- Membership check used by policies. security definer avoids RLS recursion on room_members.
create or replace function is_room_member(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members
    where room_id = p_room and user_id = auth.uid() and left_at is null
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------------
alter table profiles enable row level security;
alter table rooms enable row level security;
alter table room_members enable row level security;

-- You see your own profile and the profiles of people who share a live room with you. Nobody can
-- list all users: guests are cheap to create, so open profile reads would be a scraping hole.
-- The inner select runs under room_members RLS, so it only matches rooms you are in.
-- (Username search for friends arrives in phase 3 as a limited security definer function.)
create policy profiles_read on profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (select 1 from room_members m where m.user_id = profiles.id)
  );
create policy profiles_update_own on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- No direct lookup by code: only members can read a room, so codes cannot be enumerated.
create policy rooms_read_member on rooms for select to authenticated using (is_room_member(id));
create policy room_members_read_member on room_members for select to authenticated
  using (is_room_member(room_id));
-- No insert/update/delete policies on rooms or room_members: all writes use the functions below.

-- Table privileges as a second lock. Supabase grants broad defaults, so take them back.
revoke insert, update, delete, truncate on rooms, room_members from anon, authenticated;
revoke insert, delete, truncate on profiles from anon, authenticated;
-- A user may only edit these columns. In particular not is_guest or id.
revoke update on profiles from anon, authenticated;
grant update (username, display_name, avatar, locale, timezone) on profiles to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Room functions
-- ---------------------------------------------------------------------------------------------
create or replace function gen_room_code() returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * 32)::int, 1);
  end loop;
  return result;
end $$;

-- Only friends rooms exist in the MVP: live and quick need moderation first (see architecture.md).
create or replace function create_room(p_lesson_slug text default null)
returns rooms language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r rooms;
  tries int := 0;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_lesson_slug is not null and p_lesson_slug !~ '^[a-z0-9-]{1,64}$' then
    raise exception 'bad_lesson' using errcode = 'P0001';
  end if;
  if (select count(*) from rooms where host_id = uid and status in ('open','active')
        and expires_at > now()) >= 3 then
    raise exception 'too_many_rooms' using errcode = 'P0001';
  end if;
  loop
    begin
      insert into rooms (code, host_id, lesson_slug)
      values (gen_room_code(), uid, p_lesson_slug)
      returning * into r;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries >= 5 then raise; end if;
    end;
  end loop;
  insert into room_members (room_id, user_id, role) values (r.id, uid, 'host');
  return r;
end $$;

-- Locks the room row, so two people racing for the last seat are serialised.
create or replace function join_room(p_code text)
returns rooms language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r rooms;
  n int;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into r from rooms
    where code = upper(p_code) and status in ('open','active') and expires_at > now()
    for update;
  if not found then raise exception 'room_not_found' using errcode = 'P0002'; end if;

  if exists (select 1 from room_members
             where room_id = r.id and user_id = uid and left_at is null) then
    return r;                                   -- already in: idempotent
  end if;

  select count(*) into n from room_members where room_id = r.id and left_at is null;
  if n >= r.capacity then raise exception 'room_full' using errcode = 'P0001'; end if;

  insert into room_members (room_id, user_id, role) values (r.id, uid, 'guest')
    on conflict (room_id, user_id) do update set left_at = null, joined_at = now(), role = 'guest';

  update rooms set status = 'active', started_at = coalesce(started_at, now())
    where id = r.id returning * into r;
  return r;
end $$;

-- Leaving: promote the oldest remaining member to host, or end the room if nobody is left.
-- Returns the room id when the caller really was a member, null otherwise.
create or replace function leave_room(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r rooms;
  next_host uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into r from rooms where code = upper(p_code) and status in ('open','active') for update;
  if not found then return null; end if;
  update room_members set left_at = now()
    where room_id = r.id and user_id = uid and left_at is null;
  if not found then return null; end if;          -- caller was not in the room
  select user_id into next_host from room_members
    where room_id = r.id and left_at is null order by joined_at limit 1;
  if next_host is null then
    update rooms set status = 'ended', ended_at = now() where id = r.id;
  elsif r.host_id = uid then
    update rooms set host_id = next_host where id = r.id;
    update room_members set role = 'host' where room_id = r.id and user_id = next_host;
  end if;
  return r.id;
end $$;

-- Host only. Returns the room id when it ended, null when nothing happened.
create or replace function end_room(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  ended uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update rooms set status = 'ended', ended_at = now()
    where code = upper(p_code) and host_id = auth.uid() and status in ('open','active')
    returning id into ended;
  return ended;
end $$;

revoke all on function create_room(text), join_room(text), leave_room(text), end_room(text)
  from public, anon;
grant execute on function create_room(text), join_room(text), leave_room(text), end_room(text)
  to authenticated;
-- Anonymous (guest) sign-ins use the 'authenticated' role, so guests can host and join.
-- The helpers are internal: triggers run them, clients never call them.
revoke all on function gen_room_code(), handle_new_user() from public, anon, authenticated;
revoke all on function is_room_member(uuid) from public, anon;
grant execute on function is_room_member(uuid) to authenticated;   -- policies call it as the caller

-- ---------------------------------------------------------------------------------------------
-- Account deletion. Deleting the auth user cascades to profile, rooms hosted, memberships and
-- (phase 2+) attempts, artworks and the rest. Storage files do not cascade: see backend.md.
-- ---------------------------------------------------------------------------------------------
create or replace function delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
