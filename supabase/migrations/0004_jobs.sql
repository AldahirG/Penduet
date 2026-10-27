-- Scheduled cleanup. The work is in plain functions so tests (and a human) can call them; pg_cron
-- only schedules them. On Supabase, pg_cron is available on every plan.

create or replace function expire_rooms() returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  update rooms set status = 'expired'
    where status in ('open','active') and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;

-- Anonymous accounts idle for 30 days. Deleting the auth user cascades to everything they own.
create or replace function prune_guests() returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  delete from auth.users
    where is_anonymous and coalesce(last_sign_in_at, created_at) < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- Idempotency rows are only needed while a provider can still retry (a few days).
create or replace function prune_webhook_events() returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  delete from webhook_events where received_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function expire_rooms(), prune_guests(), prune_webhook_events()
  from public, anon, authenticated;

-- Schedule only where pg_cron exists (it does on Supabase, not on a bare local Postgres).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('expire-rooms', '*/5 * * * *', 'select expire_rooms()');
    perform cron.schedule('prune-guests', '0 3 * * 0', 'select prune_guests()');
    perform cron.schedule('prune-webhook-events', '30 3 * * *', 'select prune_webhook_events()');
  end if;
end $$;
