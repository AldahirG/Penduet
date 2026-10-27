# Build log

One line per screen or milestone item: ID, date, status, what is missing, what was harder than expected.

## M0: scaffold and primitives (2026-10-26)

Done: pnpm monorepo, web app, realtime Worker, shared protocol and lessons packages, design tokens wired into Tailwind, 18 primitives, routes for every MVP screen, a fake data layer behind the real interface.

| ID | screen | status | missing | notes |
| --- | --- | --- | --- | --- |
| S02 | Home | partial | lessons shelf, streak, daily lesson | Shows the two entry points and the co-op service status from `GET /health` |
| S09 | Rooms hub (create / join) | partial | real rooms | Works end to end against `fakeRooms` (in memory, only rooms created in the same tab can be joined). Typing `q3v-qvn` is normalised to `Q3VQVN` and auto-submits |
| S10 | Lobby | partial | live presence, start, invite by username | Static: your seat, a waiting partner chip, code + copy buttons |
| S11 | Shared canvas | not started | everything | M2 (needs M1 canvas first) |
| S05 / S06 | Lesson start and canvas | stub | lessons, guide overlay, scoring | M3. Route exists and says what is missing |
| S07 | Lesson result | component only | scoring engine | `ScoreCard` built and shown on `/design` |
| S12 | Room end | not started | | M4 |
| S19 | Free draw | stub | canvas, brush engine | M1 |
| S20 | Settings | partial | language, account | Theme switch (Auto/Light/Dark) lives in the header |
| - | `/design` | done | | Every primitive in its main states, light and dark |
| - | 404 | done | | |

### Primitives (apps/web/src/ui)
Button, ButtonLink, IconButton, TextInput, RoomCodeDisplay, RoomCodeInput, PlayerChip (incl. waiting state), ConnectionBanner, Toast, Modal (Radix Dialog), SegmentedControl, StepProgress, ScoreCard, ColourPicker, SizeControl, DrawingToolbar (roving tab stop), Spinner. Specs: `replica/design/components.md`.

Not built yet (spec exists): Drawing canvas, Guide overlay (both M1/M3), Header/tab bar are in `AppShell`.

### Checks run
- `pnpm -r typecheck`: clean in all 4 workspaces.
- `pnpm -r test`: protocol 10/10, web 10/10 (Button loading, ButtonLink, TextInput a11y, RoomCodeInput, PlayerChip label, StepProgress, DrawingToolbar arrow keys).
- `pnpm --filter @penduet/web build`: ok (427 kB JS, 41 kB CSS, fonts self-hosted).
- `pnpm dev`: web on :5173, Worker on :8787, `GET /health` returns `{"ok":true,"service":"realtime"}`; Home shows it as online.
- Browser pass at phone width (about 500 px): `/design`, `/together`, create room, join with a messy code. No console errors.

### Not done, on purpose
- **Clone screenshots for replica-diff** (`replica/clone-screens/`): there are no reference screenshots of the original in `replica/screens/` to compare against, so nothing to diff yet.
- **Desktop width (1440 px) pass** and a keyboard-only pass of every flow. The component tests cover the keyboard behaviour of the toolbar and inputs, not whole flows.
- **No git repository** in this folder, so nothing is committed. Say the word and I will `git init` and make the first commit.

### Harder than expected
- **Node 20 vs the newest tools.** The machine has Node 20.19.2. Latest `wrangler` (4.153) refuses to start below Node 22, and `jsdom` 30 crashes on load. Pinned `wrangler@4.40.0` and `jsdom@26`, which both run fine. When Node is upgraded to 22 LTS, unpin both.
- **A stray `C:\Users\pc-1175\package.json` set to yarn** made `pnpm` refuse to run here. The project's own root `package.json` now takes precedence, and the user-level file was left alone.
- **Tailwind sizes**: `h-touch` / `w-touch` were missing from the generated config, which collapsed the room-code cells to hairlines. Fixed in `build_tokens.py`.
- Tool versions are very recent (TypeScript 7, Vite 8, Vitest 5, zod 4, lucide-react 1.x). Everything typechecks and builds, but expect the odd API difference from older docs.

## Backend (2026-10-27, replica-backend)

Server side of rooms is built and tested; the client still uses the fake `RoomsApi`. Details, setup steps for your own Supabase/Cloudflare accounts, and the checklist are in `replica/backend.md`.

- Migrations 0001-0004 in `supabase/migrations`, RLS + column grants, room functions, cleanup jobs, seed. 47 SQL tests.
- Worker API (`/rooms`, `/rooms/join`, `/rooms/:code/ticket|ws|leave|end`), signed 60 s socket tickets, Turnstile hook, rate limits. 51 unit tests.
- Durable Object `Room` (ordering, snapshot, undo, clear, limits) and `Limiter`. 11 end-to-end tests on real workerd.
- Not verified: a real Supabase project, simultaneous last-seat race, Durable Object eviction.
- Harder than expected: PGlite needed a stand-in for Supabase's `auth`/`storage` schemas and default grants to test revokes honestly; `wrangler dev` leaves stale workers behind when a test run is killed (the e2e now refuses to start if its port is taken).

## M1 solo canvas and M2 rooms client (2026-10-27, replica-build)

| ID | screen | status | missing | notes |
| --- | --- | --- | --- | --- |
| S19 | Free draw | done | autosave, keyboard-only drawing | Canvas, pen/eraser, colour, size, undo, clear, save PNG. Toolbar vertical at md+, horizontal below the canvas on phones |
| S09 | Rooms hub | done | Turnstile widget | Real Worker when Supabase is configured; errors for full, not found, rate limit, 3-room cap |
| S10 + S11 | Lobby + shared canvas | done | peer-left seat release, lessons | One page. Draw while waiting. Reconnect, replaced-tab and full states |
| S12 | Room end | partial | summary of the session | "The room has closed" panel with Save as image and Back |

- One canvas, not two layers: strokes draw incrementally straight onto it and a full redraw (undo, clear, snapshot, resize) replays them in order. Simpler than the committed + live layers in the plan, and enough at 2 people.
- Verified in the browser at phone width against `pnpm dev:local` (real Worker, fake Supabase): create, partner joins, strokes both ways, undo, reload restores, end room. Also at 1440 px for /draw.
- Second identity: the browser pane refused 127.0.0.1, so the second person was `pnpm --filter @penduet/realtime partner <CODE>` (a script that joins and draws). A second real browser was not used.
- Not done: real Supabase, a real pen/tablet, keyboard-only room flow, screenshots for replica-diff.
- Known gap: a partner who closes the tab without pressing Leave keeps their seat until the room expires, so nobody else can take it.
- Tests: web 55 (board, render segments, socket reconnect/batching, rooms client), realtime 51 + 12 e2e.

## M3 lessons and scoring (2026-10-27, replica-build)

| ID | screen | status | missing | notes |
| --- | --- | --- | --- | --- |
| S05 | Lesson start | done | mode and difficulty pickers | Intro: summary, steps, time, difficulty, your best. Not the original's Relax/Learn/Draw modes |
| S06 | Lesson canvas | done | colour stage, live score, magnetic guide | Prompt, step bar, guide overlay, toolbar, Check, Skip step, retry per step |
| S07 | Lesson result | done | time and first-try rows | Per step ScoreCard and a final summary |
| - | Lessons list | done | filters, categories | `/lessons`, with best stars from this device |

- Scoring (`packages/lessons/src/score.ts`): accuracy = coverage x precision, both 0-1, where a point earns full credit within the step tolerance and nothing beyond 2.5x. Smoothness is the average distance of a line from a lightly smoothed copy of itself (corners excluded). Pass = accuracy at the step pass mark (default 65). Stars: 3 needs accuracy 88 and smoothness 70, 2 needs 78, 1 is passing. Thresholds are constants and lesson data, not UI code.
- 51 tests in the lessons package: every step of every lesson gets full marks for a clean trace, passes with a shaky-but-honest hand (jitter of a fifth of the tolerance), and fails when empty or traced in the wrong place.
- Progress is stored in this browser (localStorage). Attempts are not sent to the database: the `attempts` table needs lesson and step rows, which only exist once lessons move into the database.
- Trying it for real: a circle traced with scripted pointer events scored 100 accuracy, 90 smoothness, 3 stars. **Nobody has drawn these lessons by hand yet.** The tolerances and thresholds are my estimates and need playtesting, on a phone especially.
- Harder than expected: smoothness. A first version based on turning angles punished polygonal circles and corners, and a second one over-smoothed small eyes. It now uses a window that scales with the stroke length and ignores big deviations (corners).
- Not done: co-op lessons (M4), colour stage, hint arrows, lesson authoring tool.

## M4 co-op lessons and polish (2026-10-27, replica-build)

| ID | screen | status | missing | notes |
| --- | --- | --- | --- | --- |
| S11 | Shared canvas, lesson mode | done | colour stage, co-op scoring per person | Same step, prompt and guide for both. Check, retry, next and skip go through the room, so both screens change together |
| S12 | Room end | partial | scores of the session beyond the lesson | Ended panel shows how many strokes each person drew, Save as image |
| S20 | Settings | partial | language, email linking | Display name, delete my data. Theme stays in the header |

Co-op lesson design:
- The room keeps the lesson state (`step`, `from` = finished strokes when the step began, the latest `result`, and a summary per step), so a reconnect or reload lands on the same step and result.
- A check scores all pen strokes drawn since `from`, by either person, and the checker sends the result. Both clients apply the room's order, including their own events, so two people pressing Check together still end on the same card.
- `lesson_set` for the current step does nothing unless `restart` is set, so two people pressing Next together move one step, not two.
- Skip step is a restart (clears the step) followed by next.
- Only the lesson a room was created with can run in it: the server refuses `lesson_set` for another slug and `step_result` for a step the room is not on.

Polish:
- Settings page (rename, delete my data), page titles, an announcer and focus move on route change, a Settings link in the header.
- Free draw keeps its picture on the device (autosave, damaged data ignored, size cap).
- The canvas fits the viewport height from md up.
- Cloudflare Turnstile widget when `VITE_TURNSTILE_SITE_KEY` is set; checked against Cloudflare's always-pass test keys through the local Worker.
- A stale or deleted guest session is replaced once by a new guest instead of failing every call.
- README with how to run and check.

Verified: a lesson room in the browser with the scripted partner playing all four steps (check, next, done, summary, progress saved, reload restores the finished state); rename shows in the room; delete my data signs out and goes home; free-draw refresh restores the line. Tests: web 89, realtime 57 + 15 end-to-end, lessons 51, protocol 17, SQL 47.

Not done or not verified:
- A second real browser (the pane refused 127.0.0.1): the partner is a script. Two people with two real devices have not tried a lesson together.
- Keyboard-only and screen reader passes of the room and lesson flows. Titles, announcements and focus move are in, but nobody has listened to them.
- A partner who closes the tab without Leave still holds their seat until the room expires.
- No git repository: nothing is committed.

## Brand (2026-10-27, replica-brand)

Named **Penduet**, new cobalt palette (0 AA failures in light and dark), favicon stand-in, voice guide, ten strings rewritten, sweep clean. Details and the checks that still need a person: `replica/brand.md`. The package scope, storage keys and socket subprotocol were renamed with it. Note: the dark tokens file was emptied by a mistake in my own script mid-run and rebuilt from the values shown earlier in the session plus the shared contrast pairs; the contrast check passes.

## Launch material (2026-10-27, replica-launch)

Landing page built into `/` (`Home.tsx`) with real screenshots from the running app (`scripts/capture-landing.mjs`); `replica/launch/` holds `landing.md`, `pricing.md`, `listing.json` (passes `listing.py`) and `launch-plan.md`. Five new browser tests for the landing page, including ones that fail on fake proof and on the original's name. Pricing research read two competitor pages and could not read two others; nothing is for sale and no billing is built. The store listing is a draft: the product is not in any store.
