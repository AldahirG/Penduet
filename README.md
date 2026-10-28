# Penduet

Learn to draw with a friend. Two people open a room with a six-character code and draw on one shared canvas, free or following a guided lesson, and see each other's lines appear live.

This is a clean-room rebuild of the ideas behind an existing drawing-lesson app: the features and flows, written from scratch. The name is Penduet (see `replica/brand.md`).

## What works

- **Free draw** (`/draw`): pen, eraser, colours, size, undo, save as image. Kept on your device.
- **Lessons** (`/lessons`): eleven lessons in seven themes (warm-up, shapes, nature, animals, objects, faces, scenes), each with a dashed guide, a score for accuracy and steadiness, stars and retries. To add one, see "Adding lessons and games" below.
- **Rooms** (`/together`): create or join with a code or invite link. Two people, live strokes, reconnect, end room.
- **Lessons together**: pick a lesson when you start a room. Both of you draw each step on a clean canvas, and a check, retry or next step changes both screens.
- **Games** (pick one when you start a room): *Two halves of one picture* (eight symmetric pictures with a dashed guide; the first person draws the left half and the second the right half, and the room stops each line at the middle), *Draw a topic together* (a shared prompt, either of you can ask for a new one, no score) and *Pass the pen* (one stroke each, in turn; the room enforces whose turn it is).
- **Settings** (`/settings`): your display name, and deleting your data.

## Run it

Node 20.19 or newer and pnpm.

```bash
pnpm install
pnpm dev:local
```

That starts the web app on http://localhost:5173, the realtime Worker on :8787 and a fake Supabase on :54321 (no accounts needed, data resets when it stops). To try a room alone, in another terminal:

```bash
pnpm --filter @penduet/realtime partner ABC234
```

Add `--play` in a room made for a lesson and the partner draws the lesson with you. `pnpm dev` runs the web app only; rooms then run in demo mode without a live canvas.

To run against a real Supabase project and Cloudflare, follow **replica/backend.md** ("What you have to do").

## Check it

```bash
pnpm -r typecheck
pnpm -r test          # unit tests, SQL tests, scoring tests
pnpm test:e2e         # starts wrangler dev and a fake Supabase; two sockets play a room
pnpm --filter @penduet/web build
```

## Adding lessons and games

- **A lesson** is data: one object in `packages/lessons/src/content.ts` (slug, theme, steps with a prompt, a guide and a tolerance). It shows up in the list, in solo mode and in the room picker. `pnpm --filter @penduet/lessons test` checks every step: a clean trace must earn three stars, a shaky one must pass, and a drawing in the wrong place must not. Redeploy the Worker after adding one, because it bundles the lesson list.
- **A topic** is a line in `packages/lessons/src/topics.ts`, and **a two-halves picture** is an entry in `packages/lessons/src/halves.ts` (its left half only: the right half is the mirror). Only add to the end of either list: rooms store the index.
- **A game** is a value of `rooms.game` (migration `supabase/migrations/0005_game_modes.sql`), a state in `packages/protocol` (`gameStateSchema`), its rules in `apps/realtime/src/roomLog.ts` (pure, with tests) and a panel in `apps/web/src/games/GamePanel.tsx`.

## Layout

| Path | What |
| --- | --- |
| `apps/web` | Vite, React, Tailwind. Pages, drawing engine, socket client |
| `apps/realtime` | Cloudflare Worker (API, tickets, rate limits) and Durable Objects (`Room`, `Limiter`) |
| `packages/protocol` | zod schemas shared by the client and the Worker |
| `packages/lessons` | Lesson content and the scoring functions |
| `packages/db` | Tests for the SQL in `supabase/migrations` (PGlite) |
| `supabase/` | Migrations, seed data, CLI config |
| `replica/` | Recon, architecture, design tokens, backend notes, build log, feature matrix |

## Notes

- The plan and decisions are in `replica/PLAN.md`; what is built, what is not, and what was verified is in `replica/build-log.md` and `replica/backend.md`.
- Nothing here has run against a real Supabase project or on a real tablet with a pen yet.
