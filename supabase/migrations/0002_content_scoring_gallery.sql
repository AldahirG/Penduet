-- Phase 2: content, scoring, gallery, streaks.
-- Lessons ship as static JSON in packages/lessons for the MVP. These tables let them move into the
-- database once the authoring tool exists, and they hold attempts and artworks from day one.

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
  slug text not null check (slug ~ '^[a-z0-9-]{1,64}$'),
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
-- Writes: service role (authoring tool, seed scripts) only.
revoke insert, update, delete, truncate on courses, lessons, lesson_steps from anon, authenticated;

-- Scores use this project's own scale (0-100). They are computed on the client in the MVP, so a
-- row is a record of what the client claims, never an input to anything that grants value.
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
  unique (user_id, client_id)
);
create index attempts_user_idx on attempts (user_id, created_at desc);
create index attempts_lesson_idx on attempts (lesson_id);
create index attempts_step_idx on attempts (step_id);
create index attempts_room_idx on attempts (room_id);
alter table attempts enable row level security;
create policy attempts_own_read on attempts for select to authenticated
  using (user_id = (select auth.uid()));
-- Insert with "on conflict (user_id, client_id) do nothing" so retries are safe.
create policy attempts_own_insert on attempts for insert to authenticated
  with check (user_id = (select auth.uid()) and (room_id is null or is_room_member(room_id)));
revoke update, delete, truncate on attempts from anon, authenticated;

create table artworks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  source text not null check (source in ('lesson','free','room')),
  lesson_id uuid references lessons(id) on delete set null,
  room_id uuid references rooms(id) on delete set null,
  title text check (char_length(title) <= 80),
  -- Key in the 'artworks' bucket: <owner_id>/<artwork_id>.png. The folder is the owner.
  image_path text not null check (image_path like owner_id::text || '/%'),
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
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and (room_id is null or is_room_member(room_id)));
-- The client renders canvas.toBlob() and uploads it, so the server never renders images.

-- Private bucket, PNG only, 5 MB. Objects live under <user_id>/..., and the policies check that.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('artworks', 'artworks', false, 5242880, array['image/png'])
  on conflict (id) do nothing;
create policy artworks_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'artworks' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy artworks_obj_write on storage.objects for insert to authenticated
  with check (bucket_id = 'artworks' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy artworks_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'artworks' and (storage.foldername(name))[1] = (select auth.uid())::text);

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
