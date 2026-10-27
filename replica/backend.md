# Backend: Penduet

Written 2026-10-27 by `/replica-backend`. Reads `architecture.md`. Official APIs only, with your own keys. Nothing here talks to the original app.

## What is built, and how far it was checked

| Part | State | Checked by |
| --- | --- | --- |
| Postgres schema, 13 tables + 1 idempotency table, in `supabase/migrations/0001-0004` | done | 47 SQL tests (`packages/db`) on an in-process Postgres (PGlite) with a stand-in for Supabase's `auth` and `storage` schemas |
| Row level security + column grants on every table | done | the same 47 tests: a second user gets nothing back, forged owners are refused, direct writes to `rooms` are refused |
| Room functions `create_room`, `join_room`, `leave_room`, `end_room`, `delete_my_account` | done | SQL tests (full room, idempotent join, host handover, host-only end, cascade on delete) |
| Cleanup jobs `expire_rooms`, `prune_guests`, `prune_webhook_events` (+ pg_cron schedule) | done | SQL tests call the functions. The cron schedule itself only runs on Supabase |
| Worker API: `POST /rooms`, `POST /rooms/join`, `POST /rooms/:code/ticket`, `GET /rooms/:code/ws`, `POST /rooms/:code/leave`, `POST /rooms/:code/end`, `GET /health` | done | 51 unit tests with a fake Supabase, plus 11 end-to-end tests |
| Durable Object `Room`: seats, ordering (`seq`), stroke log, undo, clear, snapshot on connect, rate limits, 24 h cleanup alarm | done | 11 end-to-end tests: real `wrangler dev` (workerd), real SQL, two `ws` clients |
| Durable Object `Limiter` (fixed-window rate limits) | done | unit tests with a fake; exercised for real in the e2e run |
| Guest sign-in (Supabase anonymous auth) | server side done | **Not run against a real Supabase project.** The e2e uses a fake of GoTrue and PostgREST |
| Seed data (`supabase/seed.sql`, fake people only) | done | applied in the RLS tests |
| Payments, email, OAuth, Storage uploads, friends UI | **not built** | see "Not built, on purpose" |

Run everything: `pnpm -r typecheck`, `pnpm -r test` (122 tests: 14 protocol, 47 SQL, 51 Worker, 10 web), `pnpm test:e2e` (11 tests, starts `wrangler dev` on :8799 and a fake Supabase on :54399).

## What you have to do (I never create accounts or keys)

1. **Create a Supabase project** (free is fine to start). Dashboard > Authentication > Sign In / Providers > **turn on "Allow anonymous sign-ins"**. Keep the default CAPTCHA/rate-limit settings for anonymous sign-ins and check the "Anonymous sign-ins" rate limit under Authentication > Rate Limits.
2. **Apply the migrations**: `npx supabase login`, `npx supabase link --project-ref <ref>`, `pnpm db:push`. For a local copy instead: `npx supabase start` (needs Docker), which also loads `supabase/seed.sql`.
3. **Copy two public values** from Project Settings > API into `apps/realtime/.dev.vars` (copy `.dev.vars.example`) and `apps/web/.env.local`: the project URL and the publishable (anon) key. The service role key is never needed by this code. Do not paste it anywhere.
4. **Generate `TICKET_SECRET`** (command in `.dev.vars.example`). Deployed: `wrangler secret put TICKET_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
5. **Turnstile (optional, recommended before public launch):** create a Turnstile widget in your Cloudflare dashboard, put the secret in `TURNSTILE_SECRET` (Worker) and the site key in `VITE_TURNSTILE_SITE_KEY`. Until the secret is set, guests can create rooms without a check. Cloudflare publishes always-pass test keys for development.
6. **Backups:** open Dashboard > Database > Backups. As far as I know the free plan has none and paid plans have daily backups. Check your plan and switch this on before real users arrive.
7. **Set `ALLOWED_ORIGINS`** in `wrangler.toml` (or as a var) to your real web origin(s) at deploy time. It is the only thing that stops other sites from opening sockets with a stolen ticket in a browser.

## How it fits together

```
browser --(anon sign-in)--> Supabase Auth            JWT (access token)
browser --(Bearer JWT)----> Worker POST /rooms|join  --> getUser (Auth) --> rpc create_room/join_room (as the user, RLS applies)
                                                     <-- { code, lessonSlug, ticket }      ticket = HMAC {sub,name,rid,code,cap,lesson,exp 60 s}
browser --(WebSocket, ticket in Sec-WebSocket-Protocol)--> Worker --> Durable Object named by rooms.id
```

Decisions that differ from `architecture.md` (and why):

- **The Durable Object is named by `rooms.id`, not the code.** A code is unique only while its room is live, so a reused code would otherwise inherit an old room's strokes.
- **The display name travels in the signed ticket**, read from `profiles` as the user. The `hello` message is accepted and ignored, so a client cannot change its name mid-room.
- **`create_room` takes only a lesson slug.** `live` and `quick` modes stay in the table check constraint but are not creatable until moderation exists.
- **Profiles are readable only for yourself and people in your room.** The draft allowed any signed-in user to read every profile, which lets anyone scrape usernames with throwaway guest accounts. Friend search will be a limited `security definer` function.
- **Column-level grants** on `profiles` (not `is_guest`), `friendships` (status only) and `notifications` (`read_at` only), and `rooms`/`room_members` have no write privileges at all, as a second lock under RLS.
- **`leave_room` and `end_room` return the room id** (null when nothing happened) so the Worker knows which Durable Object to tell, and `end` by a non-host looks the same as an unknown code.
- **Rate limits live in a small Durable Object** (`Limiter`), not the beta Cloudflare rate-limit binding, so they work the same locally and deployed and are testable.
- **No service role key in the Worker.** Everything runs as the caller. The one thing that needs it later is deleting Storage files (below).

## Auth

- Built: anonymous sign-in on the Supabase side (profile row created by trigger, `is_guest = true`), JWT checked by asking Supabase Auth (`/auth/v1/user`) on every Worker call, never decoded locally. Works whichever signing key the project uses.
- **Deviation from the skill's "http-only cookies":** this is a single-page app that calls Supabase and a separate Worker with `Authorization: Bearer`. supabase-js keeps the session in `localStorage`. That is the normal setup for this stack, but an XSS bug could read it. Mitigations to add at deploy: a strict `Content-Security-Policy`, no third-party scripts, short `jwt_expiry` (set to 3600 in `supabase/config.toml`). Revisit if you add email accounts with money attached.
- **Sign out everywhere:** `supabase.auth.signOut({ scope: 'global' })` in the client. Nothing to build server side.
- **Account deletion:** `rpc('delete_my_account')` deletes the auth user and cascades to profile, rooms hosted, memberships, attempts, artworks, daily progress, friendships, notifications, reports and subscriptions rows (tested). **Gap:** files in the `artworks` bucket are not removed by SQL. Deleting them needs the service role (a Supabase Edge Function or a server-only call). Do this before the gallery UI ships. Room strokes in Durable Objects are deleted by their 24 h alarm.
- **Not built:** email sign-up with verification, password reset, magic link, Google/Apple. They are the "Account sync" row in `features.csv` (should-have). Path: `supabase.auth.updateUser({ email })` / `linkIdentity`, which keeps the same user id so nothing is lost. When you add it, switch Supabase Auth to a custom SMTP sender (Resend), because the built-in sender is for testing only. Apple requires account deletion in-app for apps with sign up, and that already exists.
- **Roles/teams:** not in the recon map. The only role is `host`/`guest` inside a room, decided by SQL.

## Database

- Migrations: `0001_identity_rooms`, `0002_content_scoring_gallery`, `0003_social_safety_money`, `0004_jobs`. Checked in, applied by `supabase db push` (`pnpm db:push`).
- Constraints enforced in the database: one live room per code (partial unique index), last seat via `for update` lock in `join_room`, max 3 live rooms per host, one friendship row per pair, retry-safe attempts (`user_id, client_id`), score ranges, image path must start with the owner id.
- **Race on the last seat:** the lock is in the SQL and the "third person gets `room_full`" case is tested one after the other. PGlite has a single connection, so a truly simultaneous join was **not** tested. Test it against a real project before trusting it under load.
- Seed: `supabase/seed.sql`. Three fake users, two rooms, one published and one draft lesson. Local development only.
- Backups: see step 6 above.

## Payments, email, jobs, integrations

- **Payments: not built.** PRO is a could-have in `features.csv`, and `architecture.md` puts Stripe in phase 3. Ready for it: `subscriptions` (clients cannot write) and `webhook_events` (insert the event id first, stop if the insert did nothing). Needed when you start: a Stripe account and test keys in `.env.local`, then Checkout + Customer Portal, handlers for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, signature check on the raw body. Mobile stores need their own IAP (RevenueCat or native), separate from Stripe.
- **Email: none sent** (guests have no email). Needed with accounts: Resend or Postmark from your own domain, SPF/DKIM/DMARC.
- **Jobs:** pg_cron `expire-rooms` (every 5 min), `prune-guests` (weekly, anonymous users idle 30 days), `prune-webhook-events` (daily). Durable Object alarms delete a room's stroke log 24 h after its last finished stroke, or 1 h after the host ends it. The cron lines only run on Supabase.
- **Integrations:** Cloudflare Turnstile (official siteverify API, your keys) is the only one. No Google Calendar or other scopes are used, so no OAuth verification review is needed. If Google sign-in is added later, the basic profile/email scopes do not need the long verification that sensitive scopes do, but the consent screen must still be set up and published.

## For the client work (M1/M2): how the socket behaves

- Connect: `new WebSocket(wsUrl, ['penduet.v1', ticket])` where `wsUrl` is the Worker origin with `ws(s)://` and `/rooms/<CODE>/ws`. Ticket lifetime is 60 s: ask for a new one with `POST /rooms/<CODE>/ticket` for every reconnect.
- First message in is `welcome`: your seat, the peer (or null), the committed strokes, the lesson step, `lastSeq`. It is always a full snapshot. There is no `lastSeq` gap replay yet. Replace local state with it.
- Everything a client sends comes back as `event {seq, from, body}` **to everyone including the sender**. Own `stroke_*` events can be ignored for drawing (already drawn optimistically) and used as the acknowledgement. Strokes are identified by `(authorId, id)`, so two people never collide.
- `undo` removes the sender's own latest stroke. `clear` removes everything. Both are broadcast and stored.
- If the partner is mid-stroke when you connect, that one stroke is not in your snapshot, and you will receive its `stroke_pts`/`stroke_end` without having seen its `stroke_start`. Ignore events for strokes you do not know. That stroke shows up for you on your next reconnect. Rare, and only one stroke.
- Close codes: `4001` replaced by a newer socket of yours, `4002` room full, `4003` you left, `4004` room ended (after a `room_ended` message), `1008` too many bad messages.
- Limits per socket: 16 KB per message, 80 messages and 3000 points per second, 5000 points per stroke, 2000 strokes per room (then `rate_limited`).
- `room_ended` means show S12 and stop reconnecting.

## Security checklist

- [x] secrets only in env vars; `.env`, `.env.local`, `.dev.vars` ignored; client bundle holds only public values; no service role key anywhere
- [x] input validated on the server (zod on every Worker route and every socket message; SQL checks and constraints behind them)
- [x] authorisation on every read and write, tested with a second user (47 SQL tests; Worker routes run as the caller so RLS applies)
- [~] rate limits: Worker routes (rooms created per user/hour, joins per user and per IP/minute, any route per IP) and socket limits are done. **Supabase's own limit on anonymous sign-ins is yours to check** (step 1). No email or SMS is sent
- [ ] webhooks verify signatures: no webhooks exist yet. The idempotency table is ready
- [x] uploads: bucket is private, png only, 5 MB, objects only under the owner's folder (policies tested). No upload code yet
- [x] no user data in URLs or logs: the ticket is in a header; the Worker logs error kinds only, never tokens, names or ids. Room codes appear in paths (they are short-lived invite codes). The Worker looks up the caller's profile with their id in the Supabase query string, which Supabase may log
- [~] dependencies audited: `pnpm audit --prod` is clean. `pnpm audit` shows 31 findings, **all under `wrangler@4.40.0`** (a dev tool, pinned because this machine has Node 20.19). Upgrade to Node 22 LTS and unpin wrangler to clear them
- [ ] privacy policy lists every processor: not written. Today's processors: **Supabase** (database, auth, storage), **Cloudflare** (Workers, Durable Objects, Pages, Turnstile). Add Stripe, Resend and analytics when they arrive. Guests are anonymous, but drawings and display names are personal content

## Not built, on purpose

Stripe/PRO, email and password flows, Google/Apple sign-in, Storage upload and artwork cleanup, friend search, Quick Play. Each is a could/should-have, and each needs an account or key only you can create. They are listed above with the first step.

## Known limits and untested corners

- Real Supabase was never contacted. The Worker's expectations of Supabase (the `/auth/v1/user` reply, PostgREST returning the SQL exception text as `message`, composite results as one JSON object) are from its documentation and are the first thing to confirm with your project: create a room from `curl` with a real guest token.
- Durable Object **eviction and hibernation were not exercised.** The reload from storage (strokes, seats, lesson, `seq` jump of 100 000) is written but untested. A stroke in progress during a wake-up is dropped.
- The snapshot is one message. 2000 strokes of 5000 points would be a very large frame. Realistic drawings are far below it. Add paging if lessons get long.
- Under `wrangler dev` a server-initiated close takes about 10 s to reach a Node `ws` client (the local proxy holds the TCP connection). The close frame and code are right. Not expected in production, not measured there.
- Tested on Windows, Node 20.19 only.

## Lessons in a room (added with M4)

A room created with `lessonSlug` runs that lesson. The Durable Object keeps `{slug, step, from, result, results[]}` and sends it in `welcome`, so a reconnect lands on the same step and result. Messages: `lesson_set {slug, step, restart?}` (go to a step; `restart` starts the current one over and removes its strokes from the log), `step_result {step, result}` (what a check found). The room refuses a `lesson_set` for another lesson and a `step_result` for a step it is not on, and treats a request for the step it is already on (without `restart`) as nothing, so two people pressing Next together move one step. Clients apply their own `lesson_set` and `step_result` when the room sends them back, so both end on the same state. The score itself is still computed on a client, so it is a claim, not a fact.

Turnstile: when the Worker has `TURNSTILE_SECRET`, guests must send `turnstileToken` to `POST /rooms`. The web app shows the widget when `VITE_TURNSTILE_SITE_KEY` is set. Tried locally with Cloudflare's always-pass test keys (site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`): `TURNSTILE_SECRET=... VITE_TURNSTILE_SITE_KEY=... pnpm dev:local`. Not tried with a real widget.

## Lessons and scores (added with M3)

Lessons are static content in `packages/lessons` and scoring runs on the client, as decided in `PLAN.md`. Results are kept in `localStorage` (`penduet.progress.v1`), not sent anywhere. The `attempts`, `lessons` and `lesson_steps` tables exist and are tested, but nothing writes to them yet: attempts reference lesson and step ids, which need the lessons loaded into the database first. A client-side score is a claim, so nothing that gives value (PRO, ranking) may depend on it.

## Running it locally with no accounts

`pnpm dev:local` starts the web app (`--mode devlocal`, reads `apps/web/.env.devlocal`), the real Worker, and a fake Supabase backed by the real migrations in memory (data resets when it stops). In another terminal, `pnpm --filter @penduet/realtime partner <ROOM CODE>` joins as a second guest and draws, so you can try a room alone. Plain `pnpm dev` runs the web app without a backend: rooms are in demo mode (no live canvas). The fake trusts tokens it minted itself: development only.

Client wiring added with M2: `@supabase/supabase-js` guest sign-in (`data/session.ts`), the Worker client (`data/rooms.ts`), the socket with reconnect (`data/socket.ts`). The Worker responses now include `isHost`, and the room answers `ping` with `pong` (client sends one every 25 s).

Known gap: a person who closes the tab without pressing Leave keeps their seat in the database until the room expires (24 h), so a third person cannot take it. They can come back with the code. Fix later with a grace period and a leave call from the Durable Object.

## Next

`/replica-test`: the client is wired now, so click through the flows with two real browsers. Before any public launch: the real-Supabase check above, Turnstile on, backups on, privacy policy, and the artwork-file cleanup.
