# MVP Plan: 2-Person Co-op Drawing + Guided Lessons

Working name: **Penduet** (placeholder; rebrand later, nothing of the original's code, assets or copy is reused).

## 1. Scope

**In**
- Create a room, get a 6-char invite code; a second person joins with the code (or a share link).
- Shared canvas, both draw at the same time, strokes appear live on the other side.
- Brush colour + size, eraser (own strokes), undo (own strokes), clear (confirm).
- 3 guided lessons (trace the guide step by step, per-stroke score: accuracy + smoothness).
- Co-op lesson mode: both people work the same lesson on the shared canvas.
- Solo mode (same canvas and lessons, no room) so the app is usable without a partner.
- Guest identity only (random name + id in localStorage). No accounts, no payments.

**Out (later)**
- Accounts, friends list, random matchmaking, chat, spectators, >2 players.
- Native iOS/Android builds, Apple Pencil tilt, brush library, colour mixing.
- Subscriptions, ads, streaks, achievements.

## 2. Stack (recommended)

| Layer | Choice | Why |
|---|---|---|
| Client | React + Vite + TypeScript, **Canvas 2D** + Pointer Events | Fastest path to a working canvas; pressure and coalesced events are supported; PWA installs on phone/tablet |
| Realtime | **Cloudflare Workers + Durable Objects** (WebSocket hibernation) | One Durable Object per room = single authority that orders events; no server to manage; cheap at 2 users/room |
| Shared types | `zod` schemas in a `protocol` package | One definition validates both ends |
| Persistence (MVP) | Durable Object storage (stroke log), room TTL 24h | No DB needed yet |
| Persistence (later) | Postgres/Supabase for accounts, saved drawings | Added when accounts arrive |
| Hosting | Cloudflare Pages (client) + Workers (realtime) | Same vendor, same deploy |
| Tests | Vitest (protocol, scoring), Playwright with two browser contexts (co-op e2e) | Co-op is the risky feature, test it end to end |

Alternative if you prefer a classic server: Node + `ws` on Fly.io with an in-memory room map. Same protocol, more ops work, and rooms die on deploy.

Native later: wrap the web app with Capacitor, or rebuild the client in Flutter/Swift while keeping the same protocol.

## 3. Repo layout

```
ArtWorkout/
  apps/
    web/              React client
    realtime/         Worker + Room Durable Object
  packages/
    protocol/         zod message schemas, shared types
    lessons/          lesson JSON + scoring functions (pure, unit-tested)
  PLAN.md
```
pnpm workspaces.

## 4. Architecture

```
 Client A ──ws──┐
                ├── Room Durable Object (authoritative order, stroke log)
 Client B ──ws──┘
```

- `POST /rooms` creates a room, returns `{code}`. Code: 6 chars from an unambiguous alphabet (no 0/O/1/I). `code → Durable Object id` by name.
- `GET /rooms/:code/ws` upgrades to WebSocket. Max 2 players; a third gets `room_full`.
- Client keeps `guestId` + `roomToken`; same guest reconnecting reclaims its seat.

### Canvas model
- Fixed logical canvas, 1000 x 1000 units. Every point is sent in logical units, so different screen sizes/aspect ratios match. Letterboxed on screen.
- A **stroke** = `{id, authorId, tool, color, size, points[], seq}`. Each stroke has one author, so there are no write conflicts. Draw order = server `seq` of `stroke_start`.
- Two layers per client: committed canvas (bitmap cache of finished strokes) and a live overlay for in-progress strokes. Remote strokes in progress draw on the overlay.
- Smoothing: quadratic curves through midpoints; points quantized to 1 decimal and delta-encoded on the wire.

### Wire protocol (JSON first, binary later if needed)

Client → server:
```
join        {guestId, name}
stroke_start{id, tool, color, size, t}
stroke_pts  {id, pts:[x,y,p,...]}      // batched every ~30 ms
stroke_end  {id}
undo        {}                          // removes author's last stroke
clear       {}
lesson_set  {lessonId, step}
step_result {strokeId, accuracy, smooth, passed}
```
Server → client (adds `seq`, `from`):
```
welcome     {you, peer, snapshot:{strokes[], lesson}, lastSeq}
peer_joined / peer_left
stroke_*    (relayed, stamped with seq)
undo / clear / lesson_set / step_result (relayed)
error       {code}
```
- **Optimistic local drawing**: your own strokes render immediately; the server only relays, so no visible lag for the author.
- **Late join / reconnect**: server sends `snapshot` (stroke log); reconnect sends `lastSeq`, server replays the gap.
- **Rate limits**: max points/sec and payload size per socket; reject malformed messages via zod.
- **Cleanup**: room storage deleted 24h after last activity (alarm).

### Guided lessons
Lesson JSON:
```
{ id, title, steps:[ { prompt, guide:[ polyline in logical units ... ], tolerance, mode:"trace" } ] }
```
- Guide drawn as a dashed ghost; current step highlighted.
- **Scoring** (pure function, client side for MVP):
  - *Accuracy*: mean distance of the user's stroke samples to the guide polyline, normalized by tolerance, plus coverage (fraction of the guide within tolerance).
  - *Smoothness*: speed variance and turning-angle jitter along the stroke.
  - Pass if accuracy >= threshold; show stars and a short hint ("too wavy", "too short").
- **Co-op lesson**: both on the same canvas; either person can complete a step, each stroke scored and attributed; steps advance when the server receives a passing `step_result`. Cheating is irrelevant at MVP (friendly co-op), so client-side scoring is acceptable; move it server-side if competitive modes arrive.
- Content: 3 lessons x 4-6 steps (basic shapes, a simple animal built from circles, a shaded sphere) authored as JSON by hand.

## 5. Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | Scaffold: monorepo, Vite app, Worker, CI | `pnpm dev` runs both, health endpoint works |
| M1 | Solo canvas | Smooth pressure-aware drawing, colour/size/eraser/undo, works on desktop + touch |
| M2 | Rooms + realtime | Two browsers see each other's strokes live; rejoin and late join work; Playwright e2e passes |
| M3 | Lessons | 3 lessons play solo with scoring and hints |
| M4 | Co-op lessons + polish | Shared lesson steps sync; share link; room-full/expired/offline states; deployed to a public URL |

## 6. Risks

- **Stroke smoothness vs latency**: batching trades bandwidth for lag; start at 30 ms, tune with real devices.
- **Touch/palm issues** (iOS Safari): `touch-action: none`, use `getCoalescedEvents`, ignore touch while a pen is active.
- **Scoring feel**: thresholds need playtesting; keep tolerances in lesson JSON, not code.
- **Content cost**: lessons are the real long-term work; build a tiny authoring tool (click points to make a guide) after M3.
- **Abuse** (once random matching exists): out of MVP; invite-only rooms keep it safe for now.

## 7. Decisions to confirm

1. Web/PWA first (recommended) vs native from day one.
2. Cloudflare Durable Objects (recommended) vs Node + `ws` on Fly.io.
3. Client-side scoring for MVP (recommended) vs server-side.
4. Co-op lesson style: shared canvas (recommended) vs two side-by-side canvases racing.
