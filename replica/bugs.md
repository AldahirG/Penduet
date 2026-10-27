# Bugs

Found by `/replica-test` on 2026-10-27 against the local stack (real Worker and Durable Objects, fake Supabase over the real migrations), with Chrome driven by Playwright. Only things that were reproduced are listed as bugs. Each fix has a failing test that was run first; the test name is in "Evidence". There is no git repository yet, so "fixed" means fixed in the working tree, not in a commit.

| ID | severity | title | status |
| --- | --- | --- | --- |
| BUG-001 | S3 | The header is 12 px too wide on a phone, on every page | fixed |
| BUG-002 | S2 | A stroke the partner is halfway through when you connect or reconnect never appears for you | fixed |
| BUG-003 | S3 | The canvas moves while you draw when the partner joins, drops or comes back, and the stroke bends | fixed |
| BUG-004 | S3 | The player who becomes host after the host leaves cannot end the room until they reload | fixed |
| BUG-005 | S3 | On a 1280 x 720 laptop the bottom of the canvas is off screen in a lesson and in a room | fixed |
| BUG-006 | S3 | The rooms hub has no level-one heading | fixed |
| BUG-007 | S3 | Player chips: invalid ARIA on the chip, and faded text that fails contrast for "not here yet" and "left" | fixed |
| BUG-008 | S3 | The star rating on a result card has an accessible name that screen readers may ignore | fixed |
| BUG-009 | S4 | In development the skip link is not the first Tab stop | fixed |
| BUG-010 | S4 | The brand link in the header is 28 px tall on a phone | fixed |

---

### BUG-001: The header is 12 px too wide on a phone, on every page

- Severity: S3
- Flow / case: X / X-3
- Screen: every screen
- Build: working tree after M4  Browser / device: Chrome, 390 px wide

Steps
1. Open any page at 390 px wide.
2. Read `document.documentElement.scrollWidth - clientWidth`.

Expected: 0, nothing scrolls sideways.
Actual: 12. The settings icon added in M4 pushed the theme switch 12 px past the right edge.
Evidence: `X-3 <page> fits 390px wide with no sideways scroll` (9 pages), `X-3 a live room and a lesson room fit 390px wide`, `F01-E4`, `S-E3`. All failed before the fix.
Suspected cause: header has brand, an icon button and a 180 px theme switch with 16 px gutters.
Status: fixed. Settings is now an item in the main navigation (top bar and tab bar) and the header holds only the brand and the theme switch.

### BUG-002: A stroke the partner is halfway through when you connect or reconnect never appears for you

- Severity: S2 (a stroke is missing on one screen until reload; no data lost on the server)
- Flow / case: F05 / F05-B2, F05-E8
- Screen: S11
- Build: working tree after M4  Browser / device: two Chrome contexts

Steps
1. A opens a room and presses the mouse down, draws part of a line, and holds.
2. B joins the room.
3. A finishes the line.

Expected: B sees the whole line.
Actual: B sees nothing. The snapshot B receives holds finished strokes only, and the later points and the end of A's stroke are ignored because B never saw its start. It stayed missing until B reloaded. Same thing happens when B's connection drops and comes back while A is drawing.
Evidence: `F05-B2 a stroke the partner is halfway through when you connect still arrives`, `F05-E8 a dropped connection comes back by itself`.
Suspected cause: documented gap in `replica/backend.md` ("mid-stroke when you connect").
Status: fixed. The welcome message now carries the strokes in progress with their points so far (`open`). If a person drops in the middle of a stroke, the room finishes the stroke for them and tells the others. Tests added at three levels: board, socket client, and a Worker end-to-end test.

### BUG-003: The canvas moves while you draw when the partner joins, drops or comes back, and the stroke bends

- Severity: S3
- Flow / case: F05 / F05-B1
- Screen: S10 S11
- Build: working tree after M4  Browser / device: Chrome, 1280 px

Steps
1. Host opens a room. The page shows an invitation panel above the canvas.
2. Host starts a stroke. The partner joins (the panel disappears) or drops (a banner appears).

Expected: the canvas stays where it is.
Actual: the canvas jumped by the height of the panel or banner, and the stroke in progress kinked at that point (seen in a failure screenshot: the second half of the line sat about 60 px lower).
Evidence: `F05-B1 the canvas does not move when the partner joins, drops or comes back`.
Second cause, found later by a test that failed 1 run in 8: the title row (name, two player chips, four buttons) wrapped or unwrapped depending on the width of the chip text ("not here yet" against "here"), which moved the canvas by 46 px. The header is now two fixed rows, and test `F05-B3` uses a 30-character name against a 2-character one at 1280 and 390 px.
Status: fixed. The invitation moved into an "Invite" dialog. Connection notices now sit beside the canvas (from 1024 px) or below it (phones), so nothing above the canvas changes while two people draw.

### BUG-004: The player who becomes host after the host leaves cannot end the room until they reload

- Severity: S3
- Flow / case: F05 / F05-E7
- Screen: S11
- Build: working tree after M4  Browser / device: two Chrome contexts

Steps
1. A hosts, B joins. B has no "End room" button (correct).
2. A presses Leave.

Expected: B is the host now, and "End room" appears.
Actual: the button did not appear. The database promoted B, but the page only learns "host or not" when it asks for a socket ticket.
Evidence: `F05-E7 the host leaves: the guest becomes the host and can end the room`.
Status: fixed. When the partner leaves, the page asks again.

### BUG-005: On a 1280 x 720 laptop the bottom of the canvas is off screen in a lesson and in a room

- Severity: S3
- Flow / case: X / X-8
- Screen: S06 S11
- Build: working tree after M4  Browser / device: Chrome, 1280 x 720

Steps
1. Open a lesson, start it, and look at the canvas without scrolling. Same in a room.

Expected: the whole square canvas is visible.
Actual: the lesson text, progress bar and result card sit above the canvas and push its bottom edge below the screen edge.
Evidence: `X-8 the whole canvas is on screen on a 1280x720 laptop`.
Status: fixed. From 1024 px the lesson text and results sit in a column beside the canvas; the canvas is limited by the screen height. On phones the order is unchanged.

### BUG-006: The rooms hub has no level-one heading

- Severity: S3 (axe `page-has-heading-one`)
- Flow / case: X / X-2
- Screen: S09
- Status: fixed. Added "Draw together" as the page heading.
- Evidence: `X-2 rooms hub has no axe violations` (light and dark).

### BUG-007: Player chips: invalid ARIA, and faded text that fails contrast

- Severity: S3 (axe `aria-prohibited-attr` and `color-contrast`, both "serious")
- Flow / case: X / X-2
- Screen: S10 S11 S12
- Steps: open a room and scan it. The chip had `aria-label` on a plain span (screen readers may ignore it), and the "not here yet" and "left" chips were drawn at 60% opacity, which put their grey text under 4.5:1.
- Status: fixed. The chip is a `role="group"` with its label. "Not here" is shown by a dashed border, with the text left at full contrast.
- Evidence: `X-2 a live room ...`, `X-2 closed room ...` (light and dark).

### BUG-008: The star rating on a result card has an accessible name that screen readers may ignore

- Severity: S3 (axe `aria-prohibited-attr`)
- Screen: S07, lesson summary, lessons list
- Status: fixed. The stars are `role="img"` with the label "N of 3 stars".
- Evidence: `X-2 lesson drawing screen and result card ...`.

### BUG-009: In development the skip link is not the first Tab stop

- Severity: S4 (does not happen in a production build: it comes from React StrictMode running an effect twice)
- Flow / case: X / X-5
- Steps: open any page and press Tab once.
- Expected: focus lands on "Skip to content".
- Actual: it landed on the first link in the page, because the page had already moved focus to the content on load.
- Status: fixed. Focus moves only when the address really changes.
- Evidence: `X-5 the skip link is the first tab stop and moves focus to the content`.

### BUG-010: The brand link in the header is 28 px tall on a phone

- Severity: S4 (our own design spec says touch targets are at least 44 px)
- Flow / case: X / X-3
- Steps: open any page at 390 px and measure the "Penduet" link.
- Actual: 138 x 28. Status: fixed (minimum touch height).
- Evidence: `X-3 touch targets in the toolbar and header are at least 44px`.

---

## To check (not reproduced as a bug, or decided not to fix)

- **A partner who closes the tab keeps their seat.** By design today: the room stays full until it expires (24 h), so a third person cannot join. Known gap, recorded in `replica/backend.md`. Not an automated test, because the right behaviour (grace period, then release) is not decided.
- **Opening an invite link logs a 404 in the browser console.** The page asks "am I in this room?" first and joins when the answer is no. The Worker answers 404 and the browser logs it. Harmless, and the test harness ignores 4xx console lines on purpose. Could be avoided by joining first, but joining is rate-limited more tightly than the ticket route.
- **The dev server only listens on one loopback address.** On this machine Vite is reachable at `localhost` and `[::1]` but not `127.0.0.1`. The Worker allows all three origins. The test setup picks whichever answers. Matters only for local development.
- **Three browser tests failed once in one full run and passed on every rerun** (the two-person lesson tests `C-E2` and `C-E4`, and `F05-B1`). `F05-B1` was a real intermittent layout bug (see BUG-003); the other two were not reproduced again. They passed in that suite's two other full runs and in isolation. The cause was not established. The failing run overlapped with other test processes started a minute earlier, so contention is the likely cause, but that is a guess. Watch for it; if it comes back, run those three with traces on.
- **Replaying a drawing differs from drawing it live by a few antialiased pixels** (about 0.05%). Not visible. The test for "start this step again" allows 1%.
- **Not tested here, because they need real hardware or accounts:** a real pen or touch screen, a screen reader, real Supabase, a real Turnstile widget, a second physical device, a slow mobile network.
