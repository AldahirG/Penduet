# Architecture: Penduet (a rebuild of ArtWorkout's core features)

Inputs: `recon.md`, `features.csv`, `PLAN.md`. Slice: 2-person shared canvas via invite code, real-time strokes, a few guided lessons. Everything past that follows the build order at the bottom.

## Stack

| layer | choice | why |
| --- | --- | --- |
| web client | Vite + React + TypeScript, Canvas 2D, Pointer Events, PWA | A drawing app is a client-rendered SPA with no SEO need, so Next.js adds nothing. Installable on phones and tablets. Differs from the pack default on purpose |
| styling | Tailwind with tokens from `/replica-design` | Matches the pack, fast to theme (dark mode is a should-have) |
| realtime | Cloudflare Workers + Durable Objects (WebSocket hibernation) | One object per room is a single authority that orders strokes. No server to run, cheap at 2 users per room |
| database | Postgres on Supabase | One database for profiles, rooms, content and history. RLS covers access rules |
| auth | Supabase Auth with **anonymous sign-in** | A guest gets a real `auth.uid()` on first visit, so rooms and attempts have an owner from day one. Linking an email or Google later keeps the same user id, so nothing is lost |
| payments | none in MVP. Stripe (web) and RevenueCat or store IAP (native) in phase 3 | Money is not part of the co-op slice |
| email | none in MVP. Resend when accounts need password reset and receipts | Anonymous auth needs no email |
| jobs | `pg_cron` in Supabase | Room expiry and guest cleanup are SQL one-liners |
| files | Supabase Storage, private bucket `artworks` | The client uploads its own rendered PNG, so no server-side image rendering |
| hosting | Cloudflare Pages (client) + Workers (realtime) | Same vendor as the realtime layer, one deploy path |
| shared code | pnpm monorepo: `packages/protocol` (zod), `packages/lessons` (JSON + scoring) | Client and Worker validate the same messages |
| tests | Vitest (protocol, scoring, SQL functions), Playwright with two browser contexts | Co-op is the riskiest feature, so test it end to end |

No microservices: three deployables (client, Worker, Supabase project).

## Schema

Tables: 13, in `schema.sql`. Phase 1: `profiles`, `rooms`, `room_members`. Phase 2: `courses`, `lessons`, `lesson_steps`, `attempts`, `artworks`, `daily_progress`. Phase 3: `friendships`, `notifications`, `user_reports`, `subscriptions`.

Access rules: **Postgres row level security** on every table, written in `schema.sql`.

- Everything a user owns carries `user_id` or `owner_id`, and its policy is `= (select auth.uid())`.
- Rooms and room members are readable only by members. Nobody can list or look up rooms by code, so codes cannot be enumerated. Joining goes through `join_room()`, which is `security definer`.
- Content tables (`courses`, `lessons`, `lesson_steps`) are public read when `published`, and writable only with the service role.
- `subscriptions` and `notifications` inserts are service-role only, so a client cannot grant itself PRO or forge a notification.

Hard constraints from the recon, enforced in the database:

- **Two people racing for the last seat.** `join_room()` locks the room row (`for update`), counts active members, and raises `room_full` at capacity.
- **A code is unique only while its room is live**: partial unique index `rooms_live_code_uniq` on `code where status in ('open','active')`.
- **No enumeration and bounded abuse**: max 3 open rooms per host (`too_many_rooms`), codes from a 32-character alphabet with no `0/O/1/I`, and the join route is rate limited.
- **Friend pairs are unique** whichever side asked first: unique index on `least(a,b), greatest(a,b)`.
- **Retry-safe scoring**: `attempts (user_id, client_id)` is unique, so a resent score does nothing.
- **Host leaving**: `leave_room()` promotes the oldest remaining member, and ends the room when nobody is left.

Where the strokes live: the live stroke log is held by the room's Durable Object (fast, ordered). It is **not** written to Postgres while drawing. At the end each person can save the drawing, and the client uploads a PNG to Storage and inserts an `artworks` row (with the replayable stroke JSON if wanted). That keeps the hot path off the database.

## API

Three surfaces: the Worker (room lifecycle and WebSocket), Supabase RPC/PostgREST under RLS (everything else), and Storage.

### Worker (`apps/realtime`)

All routes except `/health` need `Authorization: Bearer <Supabase JWT>`. The Worker forwards the user's JWT to Supabase when it calls RPCs, so `auth.uid()` is the caller and no service role key is involved in the MVP.

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| POST /rooms | create room via `create_room()`, init the Durable Object | signed-in (guest ok) | `{mode?, lessonSlug?}` + Turnstile token for guests | `{code, ticket}` | F05 |
| POST /rooms/join | join via `join_room()` | signed-in | `{code}` | `{code, ticket}` or `room_full` / `room_not_found` | F05 |
| POST /rooms/:code/ticket | new 60 s socket ticket for reconnect | room member (checked through RLS) | none | `{ticket}` | F05 |
| GET /rooms/:code/ws | WebSocket upgrade into the room's Durable Object | holder of a valid ticket | ticket in `Sec-WebSocket-Protocol` | stroke protocol (see `PLAN.md` section 4) | F05, F12 |
| POST /rooms/:code/leave | `leave_room()`, close the socket | member | none | `204` | F05 |
| POST /rooms/:code/end | `end_room()`, tell the peer | host | none | `204` | F05 |
| GET /health | liveness | anyone | none | `{ok:true}` | n/a |

Ticket: HMAC-signed `{sub, room, exp}` with a Worker secret, valid 60 seconds. It goes in the WebSocket subprotocol header, not the URL, so it does not land in logs. The Durable Object re-checks `room`, allows at most 2 sockets, and replaces an older socket from the same user.

### Supabase, called directly from the client (RLS decides)

| call | does | who | flow |
| --- | --- | --- | --- |
| `auth.signInAnonymously()` | create a guest on first visit | anyone | F01 |
| `auth.updateUser / linkIdentity` | upgrade guest to email or Google, same user id | guest | phase 2 |
| `profiles` select / update | read peers, rename self, set username | own row for update | F01, F09 |
| `courses`, `lessons`, `lesson_steps` select | list and load lessons | anyone, published only | F02, F03 |
| `attempts` insert (`on conflict do nothing`) | save a step score | owner | F02, F12 |
| `artworks` insert / select / delete + Storage upload | gallery | owner | F11 |
| `daily_progress` upsert / select | streak | owner | F02 |
| `friendships` insert / update / delete / select | friends | the two parties | F06, F09 |
| `notifications` select / update `read_at` | inbox | owner | F06 |
| `user_reports` insert | report a player | reporter | F07 |

Webhooks in: none in MVP. Phase 3: Stripe (`checkout.session.completed`, `customer.subscription.*`) and RevenueCat or store server notifications, each writing `subscriptions` with the service role. Webhooks out: none.

Jobs (pg_cron, in `schema.sql`):

| name | schedule | does |
| --- | --- | --- |
| expire-rooms | every 5 min | `rooms.status = 'expired'` where `expires_at < now()` |
| prune-guests | weekly | delete anonymous users idle 30 days (cascades to their data) |
| room storage cleanup | Durable Object alarm, 24 h after last activity | delete the stroke log from DO storage |

Only official APIs with this project's own keys. Nothing from the original's private endpoints.

## The parts that bite

- **Realtime ordering and reconnect.** The Durable Object stamps every event with a `seq`. A reconnecting client sends `lastSeq` and gets the gap, or a snapshot if the gap is too old. Strokes have one author each, so no merge logic is needed.
- **Optimistic drawing.** Your own strokes render before the server confirms. Remote strokes render on a live overlay and commit when `stroke_end` arrives.
- **Mobile pointer events.** iOS Safari needs `touch-action: none`, `getCoalescedEvents()` for smooth lines, and palm rejection while a pen is down. Test on real tablets early.
- **Different screens.** Points travel in a 1000 x 1000 logical space, letterboxed on screen. Never send pixels.
- **Payload and rate limits.** Cap points per second and message size per socket in the Durable Object. Validate every message with zod. Reject anything else.
- **Anonymous-account abuse.** Guests are cheap to create. Turnstile on `POST /rooms` for guests, Cloudflare rate limits per IP on `/rooms/join`, a per-host open-room cap in SQL. Room codes use `random()`, which is fine for short-lived invite codes, but switch to `gen_random_bytes` if codes ever protect anything valuable.
- **Races.** Last seat: solved by the row lock. Host and guest leaving at once: `leave_room()` also locks the room row.
- **Idempotency.** `attempts.client_id` now; Stripe and store webhooks arrive twice later, so key them on event id.
- **Time zones.** A "day" for the streak is cut in `profiles.timezone`, not UTC. Store the zone at sign-up and let the user change it.
- **Long sockets and token expiry.** The JWT expires, the socket does not. The socket is authorised once by its ticket, and a reconnect fetches a new ticket.
- **Offline.** Solo lessons work offline when lessons are bundled and the PWA caches them. Rooms need a connection and show a clear "reconnecting" state.
- **Children and strangers.** Invite-only rooms in the MVP. Quick Play with strangers waits for `user_reports`, moderation, and an age policy (COPPA / GDPR-K) before it ships. No free-text chat with strangers.
- **GDPR deletion.** Deleting the `auth.users` row cascades to profile, rooms hosted, memberships, attempts and artworks rows. Storage objects do not cascade, so a deletion job removes `artworks/<user_id>/`.
- **Search.** Username search is an indexed prefix match on `profiles.username`. No search service needed.
- **Scoring feel.** Thresholds live in lesson JSON (`tolerance`), not in code, so they can be tuned without a deploy. Unit-test the scoring functions with recorded strokes.

## Build order

Screens use the S-IDs from `recon.md`. Tables are from `schema.sql`.

1. **Vertical slice (M0 to M2).** Two browsers draw on one canvas through an invite code. Ugly is fine.
   - Screens: S09 (create / join), S10 (lobby, minimal), S11 (shared canvas).
   - Tables: `profiles`, `rooms`, `room_members` (+ functions).
   - Routes: `POST /rooms`, `POST /rooms/join`, `POST /rooms/:code/ticket`, `GET /rooms/:code/ws`, `GET /health`, guest sign-in.
   - Proves: the stack, auth, the ticket handshake, ordering, late join, reconnect.
2. **Must-haves.** Solo canvas polish (colour, size, eraser, undo), guided lessons, scoring, co-op lessons, leave/end room.
   - Screens: S02 (home), S05 (lesson start), S06 (lesson canvas), S07 (result), S12 (room end), S19 (free canvas).
   - Tables: no new ones (lessons are static JSON in `packages/lessons`).
   - Routes: `POST /rooms/:code/leave`, `POST /rooms/:code/end`.
   - Matches the 14 must rows in `features.csv`.
3. **Should-haves.** Accounts (link email/Google), lessons and attempts in the database, gallery and export, streak, share link, friends, notifications, dark mode.
   - Screens: S03, S04, S08, S14, S15, S16, S20, S21.
   - Tables: `courses`, `lessons`, `lesson_steps`, `attempts`, `artworks`, `daily_progress`, `friendships`, `notifications`.
   - Routes: PostgREST under RLS, no new Worker routes except invite push.
4. **Could-haves.** Quick Play with strangers (after `user_reports` and moderation), Live Session, PRO and paywall, energy, parent dashboard, lesson authoring tool, pixel mode, colour-mixing lessons.
   - Screens: S13, S17, S18, S22.
   - Tables: `user_reports`, `subscriptions`.
   - Routes: payment webhooks, matchmaking.
5. **Fixes from `/replica-entrepreneur`**, once it has run.

## Three riskiest parts

1. Realtime canvas that stays smooth and consistent on real tablets and flaky mobile networks.
2. A scoring algorithm that feels fair. It is subjective, needs playtesting, and is the product's core.
3. Content: lessons are authored by hand, and an authoring tool is needed before the library can grow past a handful.

Next step: `/replica-design`.
