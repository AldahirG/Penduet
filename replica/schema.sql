-- NOTE: this file is the planning draft. The source of truth is supabase/migrations/ (0001 to 0004),
-- which tightened several rules while they were tested: profiles are readable only for yourself and
-- people in your room, column-level update grants, no direct writes to rooms, leave_room/end_room
-- return the room id, create_room takes only a lesson slug, and delete_my_account() exists.
-- Do not run this file. See replica/backend.md.

-- Penduet schema (Supabase Postgres). Written for Supabase: uses auth.users and auth.uid().
-- Run PHASE 1 first (M0-M4 in architecture.md). PHASE 2 and 3 are added by later migrations.
-- Access rules: Postgres row level security on every table. Writes that must bypass RLS
-- (webhooks, notifications from the Worker) use the service role key, never shipped to a client.
-- Times are timestamptz (UTC). Money is integer cents + currency.

create extension if not exists citext;

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =====================================================================
-- PHASE 1: identity + rooms (the co-op MVP)
-- Lessons ship as static JSON in the client in phase 1, so rooms point at a lesson slug.
-- =====================================================================

-- profiles.id equals auth.users.id (deliberate: one row per auth user, no separate uuid).
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

-- A profile is created for every new auth user, including anonymous (guest) sign-ins.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hex text := substr(replace(new.id::text, '-', ''), 1, 8);
begin
  insert into profiles (id, username, display_name, is_guest)
  values (new.id, 'artist_' || hex, 'Artist ' || upper(substr(hex, 1, 4)),
          coalesce(new.is_anonymous, true));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles enable row level security;
-- Any signed-in user can read profiles (needed for friend search and peer names). No emails here.
create policy profiles_read on profiles for select to authenticated using (true);
create policy profiles_update_own on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),  -- 32-char alphabet, no 0/O/1/I
  host_id uuid not null references profiles(id) on delete cascade,
  mode text not null default 'friends' check (mode in ('friends','live','quick')),
  lesson_slug text,                                        -- null = free canvas
  capacity smallint not null default 2 check (capacity between 2 and 10),
  status text not null default 'open' check (status in ('open','active','ended','expired')),
  expires_at timestamptz not null default now() + interval '24 hours',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- A code is unique only while the room is live, so codes can be reused after a room ends.
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

alter table rooms enable row level security;
alter table room_members enable row level security;
-- No direct lookup by code: only members can read a room, so codes cannot be enumerated.
-- Joining goes through join_room(), which is security definer.
create policy rooms_read_member on rooms for select to authenticated using (is_room_member(id));
create policy room_members_read_member on room_members for select to authenticated
  using (is_room_member(room_id));
-- No insert/update/delete policies: all writes go through the functions below.

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

create or replace function create_room(p_mode text default 'friends', p_lesson_slug text default null)
returns rooms language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r rooms;
  tries int := 0;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if (select count(*) from rooms where host_id = uid and status in ('open','active')) >= 3 then
    raise exception 'too_many_rooms' using errcode = 'P0001';
  end if;
  loop
    begin
      insert into rooms (code, host_id, mode, lesson_slug)
      values (gen_room_code(), uid, p_mode, p_lesson_slug)
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
    on conflict (room_id, user_id) do update set left_at = null, joined_at = now();

  update rooms set status = 'active', started_at = coalesce(started_at, now())
    where id = r.id returning * into r;
  return r;
end $$;

-- Leaving: promote the oldest remaining member to host, or end the room if nobody is left.
create or replace function leave_room(p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r rooms;
  next_host uuid;
begin
  select * into r from rooms where code = upper(p_code) and status in ('open','active') for update;
  if not found then return; end if;
  update room_members set left_at = now()
    where room_id = r.id and user_id = uid and left_at is null;
  select user_id into next_host from room_members
    where room_id = r.id and left_at is null order by joined_at limit 1;
  if next_host is null then
    update rooms set status = 'ended', ended_at = now() where id = r.id;
  elsif r.host_id = uid then
    update rooms set host_id = next_host where id = r.id;
    update room_members set role = 'host' where room_id = r.id and user_id = next_host;
  end if;
end $$;

create or replace function end_room(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update rooms set status = 'ended', ended_at = now()
    where code = upper(p_code) and host_id = auth.uid() and status in ('open','active');
end $$;

revoke all on function create_room(text, text), join_room(text), leave_room(text), end_room(text)
  from public, anon;
grant execute on function create_room(text, text), join_room(text), leave_room(text), end_room(text)
  to authenticated;
-- Anonymous (guest) sign-ins use the 'authenticated' role, so guests can host and join.

-- =====================================================================
-- PHASE 2: content, scoring, gallery, streaks
-- Lessons move from static JSON to the database when the authoring tool exists.
-- =====================================================================

create table courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  level text not null default 'beginner' check (level in ('beginner','intermediate','advanced','all')),
  is_premium boolean not null default false,
  position int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courses_published_pos_idx on courses (published, position);
create trigger courses_updated before update on courses
  for each row execute function set_updated_at();

create table lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  slug text not null,
  title text not null,
  difficulty smallint not null default 1 check (difficulty between 1 and 5),
  est_minutes smallint not null default 10 check (est_minutes > 0),
  position int not null default 0,
  is_premium boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug)
);
create index lessons_course_pos_idx on lessons (course_id, position);
create unique index lessons_slug_uniq on lessons (slug);   -- rooms.lesson_slug refers to this
create trigger lessons_updated before update on lessons
  for each row execute function set_updated_at();

create table lesson_steps (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  position int not null,
  stage text not null check (stage in ('lines','shapes','details','colour')),
  prompt text not null,
  -- {"paths": [[[x,y],[x,y],...], ...]} in the 1000 x 1000 logical canvas
  guide jsonb not null,
  tolerance numeric(6,2) not null default 24 check (tolerance > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, position)
);
create trigger lesson_steps_updated before update on lesson_steps
  for each row execute function set_updated_at();

alter table courses enable row level security;
alter table lessons enable row level security;
alter table lesson_steps enable row level security;
create policy courses_read on courses for select to anon, authenticated using (published);
create policy lessons_read on lessons for select to anon, authenticated using (published);
create policy lesson_steps_read on lesson_steps for select to anon, authenticated
  using (exists (select 1 from lessons l where l.id = lesson_id and l.published));
-- Writes: service role (authoring tool / seed scripts) only.

-- Scores use this project's own scale (0-100), not the original's.
create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  step_id uuid not null references lesson_steps(id) on delete cascade,
  room_id uuid references rooms(id) on delete set null,
  client_id uuid not null,                          -- idempotency key, generated on the client
  attempt_no smallint not null default 1 check (attempt_no >= 1),
  accuracy smallint not null check (accuracy between 0 and 100),
  smoothness smallint not null check (smoothness between 0 and 100),
  duration_ms integer not null check (duration_ms >= 0),
  passed boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index attempts_user_idx on attempts (user_id, created_at desc);
create index attempts_lesson_idx on attempts (lesson_id);
create index attempts_step_idx on attempts (step_id);
create index attempts_room_idx on attempts (room_id);
alter table attempts enable row level security;
create policy attempts_own_read on attempts for select to authenticated
  using (user_id = (select auth.uid()));
create policy attempts_own_insert on attempts for insert to authenticated
  with check (user_id = (select auth.uid()));
-- Insert with "on conflict (user_id, client_id) do nothing" so retries are safe.

create table artworks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  source text not null check (source in ('lesson','free','room')),
  lesson_id uuid references lessons(id) on delete set null,
  room_id uuid references rooms(id) on delete set null,
  title text,
  image_path text not null,                         -- key in the 'artworks' storage bucket
  strokes jsonb,                                    -- replayable stroke log, optional
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index artworks_owner_idx on artworks (owner_id, created_at desc);
create index artworks_lesson_idx on artworks (lesson_id);
create index artworks_room_idx on artworks (room_id);
create trigger artworks_updated before update on artworks
  for each row execute function set_updated_at();
alter table artworks enable row level security;
create policy artworks_own on artworks for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
-- The client renders canvas.toBlob() and uploads it, so the server never renders images.

insert into storage.buckets (id, name, public) values ('artworks', 'artworks', false)
  on conflict (id) do nothing;
create policy artworks_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'artworks' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy artworks_obj_write on storage.objects for insert to authenticated
  with check (bucket_id = 'artworks' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy artworks_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'artworks' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Object path convention: artworks/<user_id>/<artwork_id>.png

-- One row per user per local day. Streak = consecutive days with lessons_completed > 0,
-- days cut using profiles.timezone.
create table daily_progress (
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  lessons_completed integer not null default 0 check (lessons_completed >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table daily_progress enable row level security;
create policy daily_progress_own on daily_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- =====================================================================
-- PHASE 3: social, safety, money
-- =====================================================================

create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendship_not_self check (requester_id <> addressee_id)
);
-- One row per pair, whichever side asked first.
create unique index friendships_pair_uniq
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_requester_idx on friendships (requester_id);
create index friendships_addressee_idx on friendships (addressee_id, status);
create trigger friendships_updated before update on friendships
  for each row execute function set_updated_at();
alter table friendships enable row level security;
create policy friendships_read on friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
create policy friendships_request on friendships for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');
create policy friendships_respond on friendships for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()) and status in ('accepted','blocked'));
create policy friendships_delete on friendships for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('friend_request','lobby_invite')),
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);
alter table notifications enable row level security;
create policy notifications_own_read on notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_own_update on notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Inserts: the trigger below (friend requests) and the Worker with the service role (lobby invites).

create or replace function notify_friend_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, type, payload)
  values (new.addressee_id, 'friend_request',
          jsonb_build_object('from', new.requester_id, 'friendship_id', new.id));
  return new;
end $$;
create trigger friendships_notify after insert on friendships
  for each row execute function notify_friend_request();

-- Required before Quick Play with strangers is switched on.
create table user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  reported_id uuid not null references profiles(id) on delete cascade,
  room_id uuid references rooms(id) on delete set null,
  reason text not null check (reason in ('inappropriate_drawing','harassment','spam','other')),
  details text check (char_length(details) <= 500),
  created_at timestamptz not null default now()
);
create index user_reports_reported_idx on user_reports (reported_id);
create index user_reports_reporter_idx on user_reports (reporter_id);
create index user_reports_room_idx on user_reports (room_id);
alter table user_reports enable row level security;
create policy user_reports_insert on user_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
-- No read policy: only moderators with the service role see reports.

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null check (provider in ('stripe','apple','google')),
  provider_ref text not null,                       -- subscription id at the provider
  plan text not null check (plan in ('weekly','monthly','quarterly','yearly')),
  status text not null check (status in ('trialing','active','past_due','canceled','expired')),
  price_cents integer not null check (price_cents >= 0),
  currency char(3) not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_ref)
);
create index subscriptions_user_idx on subscriptions (user_id);
create trigger subscriptions_updated before update on subscriptions
  for each row execute function set_updated_at();
alter table subscriptions enable row level security;
create policy subscriptions_own_read on subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
-- Writes: webhooks with the service role only. A client can never grant itself PRO.

-- =====================================================================
-- Jobs (pg_cron)
-- =====================================================================
-- Expire rooms every 5 minutes:
--   select cron.schedule('expire-rooms', '*/5 * * * *',
--     $$ update rooms set status = 'expired' where status in ('open','active') and expires_at < now() $$);
-- Drop abandoned guest accounts weekly (cascades to profiles and everything below):
--   select cron.schedule('prune-guests', '0 3 * * 0',
--     $$ delete from auth.users where is_anonymous and coalesce(last_sign_in_at, created_at) < now() - interval '30 days' $$);
