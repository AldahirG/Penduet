-- A fifth game: draw and guess. One person draws a secret word in short bursts, the other has one try after
-- each burst. The room (the Durable Object) runs the clock and holds the word; the database only has to
-- know that `guess` is a game a room may be made for.

alter table rooms drop constraint rooms_game_check;
alter table rooms add constraint rooms_game_check
  check (game in ('free', 'topic', 'turns', 'halves', 'guess'));

create or replace function create_room(p_lesson_slug text default null, p_game text default 'free')
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
  if p_game is null or p_game not in ('free', 'topic', 'turns', 'halves', 'guess') then
    raise exception 'bad_game' using errcode = 'P0001';
  end if;
  if p_game <> 'free' and p_lesson_slug is not null then
    raise exception 'bad_game' using errcode = 'P0001';   -- a lesson and a game are different things
  end if;
  if (select count(*) from rooms where host_id = uid and status in ('open','active')
        and expires_at > now()) >= 3 then
    raise exception 'too_many_rooms' using errcode = 'P0001';
  end if;
  loop
    begin
      insert into rooms (code, host_id, lesson_slug, game)
      values (gen_room_code(), uid, p_lesson_slug, p_game)
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

revoke all on function create_room(text, text) from public, anon;
grant execute on function create_room(text, text) to authenticated;
