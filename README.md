# Penduet

Learn to draw with a friend. Two people open a room with a six-character code and draw on one shared canvas, free or following a guided lesson, and see each other's lines appear live.

This is a clean-room rebuild of the ideas behind an existing drawing-lesson app: the features and flows, written from scratch. The name is Penduet (see `replica/brand.md`).

## What works

- **Free draw** (`/draw`): pen, eraser, colours, size, undo, save as image. Kept on your device.
- **Lessons** (`/lessons`): three starter lessons with a dashed guide, a score for accuracy and steadiness, stars and retries.
- **Rooms** (`/together`): create or join with a code or invite link. Two people, live strokes, reconnect, end room.
- **Lessons together**: pick a lesson when you start a room. Both of you draw each step on the same canvas, and a check, retry or next step changes both screens.
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
