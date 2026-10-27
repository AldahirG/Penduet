-- Fake data for local development. No real people. Never run this against production.
-- Fixed ids so tests and screenshots are repeatable.

insert into auth.users (id, is_anonymous, created_at, last_sign_in_at) values
  ('00000000-0000-4000-8000-000000000001', true, now(), now()),
  ('00000000-0000-4000-8000-000000000002', true, now(), now()),
  ('00000000-0000-4000-8000-000000000003', true, now(), now())
on conflict (id) do nothing;   -- handle_new_user() creates the profiles

update profiles set username = 'mara_draws', display_name = 'Mara'
  where id = '00000000-0000-4000-8000-000000000001';
update profiles set username = 'teo_sketch', display_name = 'Teo'
  where id = '00000000-0000-4000-8000-000000000002';
update profiles set username = 'lonely_pencil', display_name = 'Ines'
  where id = '00000000-0000-4000-8000-000000000003';

-- One live room with Mara and Teo (full), one open room with Ines waiting for a partner.
insert into rooms (id, code, host_id, status, started_at) values
  ('10000000-0000-4000-8000-000000000001', 'ABCD23', '00000000-0000-4000-8000-000000000001', 'active', now()),
  ('10000000-0000-4000-8000-000000000002', 'WXYZ89', '00000000-0000-4000-8000-000000000003', 'open', null)
on conflict (id) do nothing;
insert into room_members (room_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'host'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'guest'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'host')
on conflict (room_id, user_id) do nothing;

-- One published course with one lesson of two steps, and one unpublished lesson (must stay hidden).
insert into courses (id, slug, title, category, published) values
  ('20000000-0000-4000-8000-000000000001', 'first-lines', 'First lines', 'basics', true)
on conflict (id) do nothing;
insert into lessons (id, course_id, slug, title, published) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'straight-lines', 'Straight lines', true),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'draft-wave', 'Draft wave', false)
on conflict (id) do nothing;
insert into lesson_steps (id, lesson_id, position, stage, prompt, guide, tolerance) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 0, 'lines',
   'Trace the horizontal line from left to right.',
   '{"paths": [[[100, 500], [900, 500]]]}', 30),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 1, 'lines',
   'Trace the vertical line from top to bottom.',
   '{"paths": [[[500, 100], [500, 900]]]}', 30)
on conflict (id) do nothing;
