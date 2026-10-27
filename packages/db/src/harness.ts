import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { citext } from '@electric-sql/pglite/contrib/citext'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'supabase')
export const migrationsDir = join(root, 'migrations')
export const seedFile = join(root, 'seed.sql')

// The slice of Supabase's own schemas that our migrations touch, and the roles PostgREST uses.
// Only what a migration needs to run and what policies call: this is a test stand-in, not Supabase.
const SUPABASE_STANDIN = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean not null default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;

grant usage on schema auth, storage, public to anon, authenticated, service_role;
grant execute on function auth.uid(), storage.foldername(text) to anon, authenticated, service_role;
grant all on auth.users, storage.buckets, storage.objects to service_role;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
-- Supabase gives anon and authenticated broad table privileges by default. Migrations revoke
-- what they do not want, so reproduce the default to test that they do.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`

export async function createDb(opts: { seed?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite({ extensions: { citext } })
  await db.exec(SUPABASE_STANDIN)
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'))
  }
  if (opts.seed) await db.exec(readFileSync(seedFile, 'utf8'))
  return db
}

export type Db = PGlite
type Params = unknown[]

/** Runs one query the way PostgREST would: as `authenticated`, with the user id in the JWT claim. */
export async function asUser<T = Record<string, unknown>>(
  db: Db,
  uid: string,
  sql: string,
  params: Params = [],
): Promise<T[]> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid])
  await db.exec('set role authenticated')
  try {
    return (await db.query<T>(sql, params)).rows
  } finally {
    await db.exec('reset role')
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}

/** Same, as a signed-out visitor (role anon, no user id). */
export async function asAnon<T = Record<string, unknown>>(db: Db, sql: string, params: Params = []): Promise<T[]> {
  await db.exec('set role anon')
  try {
    return (await db.query<T>(sql, params)).rows
  } finally {
    await db.exec('reset role')
  }
}

/** Same, as a role with no RLS limits. Only for setting up data the clients cannot write. */
export async function asService<T = Record<string, unknown>>(db: Db, sql: string, params: Params = []): Promise<T[]> {
  await db.exec('set role service_role')
  try {
    return (await db.query<T>(sql, params)).rows
  } finally {
    await db.exec('reset role')
  }
}

/** The one row a query is expected to return. */
export function one<T>(rows: T[]): T {
  if (rows.length !== 1) throw new Error(`expected 1 row, got ${rows.length}`)
  return rows[0] as T
}

/** A new guest. The on_auth_user_created trigger makes the profile, as it does on Supabase. */
export async function newGuest(db: Db): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (is_anonymous) values (true) returning id`,
  )
  return rows[0]!.id
}
