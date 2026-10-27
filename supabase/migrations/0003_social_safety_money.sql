-- Phase 3: friends, notifications, reports, subscriptions.
-- Tables exist now so the access rules are written and tested once. No screen uses them yet.

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
-- Either side can unfriend or withdraw a request. Only the blocker can remove a block, so the
-- blocked person cannot delete the row and ask again.
create policy friendships_delete on friendships for delete to authenticated
  using (
    (select auth.uid()) in (requester_id, addressee_id)
    and (status <> 'blocked' or addressee_id = (select auth.uid()))
  );
-- The addressee may change the status and nothing else.
revoke update on friendships from anon, authenticated;
grant update (status) on friendships to authenticated;

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
revoke insert, delete, truncate on notifications from anon, authenticated;
revoke update on notifications from anon, authenticated;
grant update (read_at) on notifications to authenticated;

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
revoke all on function notify_friend_request() from public, anon, authenticated;

-- Required before Quick Play with strangers is switched on.
create table user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  reported_id uuid not null references profiles(id) on delete cascade,
  room_id uuid references rooms(id) on delete set null,
  reason text not null check (reason in ('inappropriate_drawing','harassment','spam','other')),
  details text check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  constraint report_not_self check (reporter_id <> reported_id)
);
create index user_reports_reported_idx on user_reports (reported_id);
create index user_reports_reporter_idx on user_reports (reporter_id);
create index user_reports_room_idx on user_reports (room_id);
alter table user_reports enable row level security;
create policy user_reports_insert on user_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
-- No read policy: only moderators with the service role see reports.
revoke update, delete, truncate on user_reports from anon, authenticated;

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
revoke insert, update, delete, truncate on subscriptions from anon, authenticated;

-- Payment webhooks arrive more than once. A handler inserts the provider's event id first and
-- stops if that insert did nothing.
create table webhook_events (
  provider text not null check (provider in ('stripe','apple','google')),
  event_id text not null,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);
alter table webhook_events enable row level security;   -- no policies: service role only
revoke all on webhook_events from anon, authenticated;
