# Parity: Penduet against the original

Date: 2026-10-27. Build: working tree after M4 (no git repository). Tests at this build: 252 unit, SQL and Worker tests, 16 Worker end-to-end tests, 109 browser tests (`replica/test-plan.md`), all passing on the last full run.

**Verdict: not shippable.** Two must-haves are only partly done, and the product has not met a real person yet. No open S1 or S2 bug.

## Feature score

68.7 of 100 on the weighted matrix (must 3, should 2, could 1, partial counts half). 34 rows are counted. Rows the original does not have (the seven added by `/replica-entrepreneur` and the lesson authoring tool) and rows marked skip are not scored.

Must-haves: 12 of 14 done. The two that are partial:

1. **Guided lesson with staged steps**: lines, shapes and details work; the colour stage does not exist.
2. **Per-stroke score**: scoring is per step and on demand, not live per stroke, and the thresholds have never been tried by a person drawing.

By area and the full missing list in build order:

### Parity: 68.7 / 100

features 68.7  (34 counted, must-haves 12 of 14 done)

Not shippable yet: 2 must-have features are not done.

## By area, weakest first
- accounts                       0.0  (1 features)
- safety                         0.0  (1 features)
- social                        25.0  (2 features)
- retention                     25.0  (2 features)
- monetisation                  25.0  (2 features)
- gallery                       50.0  (2 features)
- settings                      50.0  (2 features)
- lessons                       75.0  (6 features)
- multiplayer                   84.0  (11 features)
- canvas                        90.0  (4 features)
- onboarding                   100.0  (1 features)

## Missing, in build order
- [must] lessons: Guided lesson with staged steps (lines/shapes/details/colour), partial  (S05/S06: staged steps with prompts, step bar, skip. Stages lines, shapes, details; no colour stage yet)
- [must] lessons: Per-stroke score: accuracy and smoothness, partial  (Own algorithm, scored per step on all strokes drawn in it (coverage x precision, plus steadiness). Check on demand, not live per stroke. Needs playtesting with real people)
- [should] accounts: Account sync across devices, no  (needs email/Google linking: Supabase linkIdentity, not wired. See backend.md)
- [should] multiplayer: Live Session (same preselected lesson for all), no  (from search snippet of the changelog; confirm in app)
- [should] retention: Daily goal and achievements, no  (changelog 1.14.1)
- [should] settings: Multiple languages, no  (12 languages on the site; clone starts with 2)
- [should] social: Invite a friend by username, no  (needs accounts)
- [should] gallery: Export artwork as image, partial  ("Save as image" PNG download on S19 and S11; no gallery)
- [should] gallery: Save drawings to a gallery, partial  (artworks table, private png-only 5 MB bucket and RLS tested. No upload UI. Storage files are not removed by account deletion yet)
- [should] retention: Daily lesson and streak, partial  (daily_progress table + RLS only)
- [should] social: Friends list and requests, partial  (friendships + notifications tables, RLS and trigger tested. Username search function not written)
- [could] canvas: Pixel drawing mode, no  (changelog 1.14.6)
- [could] lessons: Colour-mixing lessons, no  (changelog 1.14.16)
- [could] monetisation: Energy system (free daily), no  (rules unknown)
- [could] multiplayer: Chameleon hide-and-seek mode, no  (rules unknown; changelog 1.14.6 only)
- [could] multiplayer: Quick Play with strangers, no  (needs moderation and reporting first)
- [could] safety: Parent dashboard and time limits, no  (help center only; legal duties if kids)
- [could] monetisation: PRO subscription and paywall, partial  (subscriptions + webhook_events tables, client cannot write. No Stripe code: needs the owner Stripe test keys)

## Left out on purpose (not scored)
- Licensed collections (e.g. Winx Club): licensed IP
- Their 75M-user network and community: not rebuildable
- Creator/TikTok partnerships: partner deals
- Proprietary stroke-analysis algorithm: write your own scoring
- Brand name logo mascot and marketing copy: never reuse; see replica-brand
- Siri/Shortcuts and Screen Time blocking: iOS-native; out of MVP
- Ad-based energy refill: ad network and ads are out of MVP
- Store screenshots and app assets: reference only; never shipped

## Yours, not in the original (not scored)
- Lesson authoring tool (click to draw a guide)
- Core is free: every lesson, room and tool, no ads, no energy, no trial wall
- Rooms hold only real invited people (no bots, no replays)
- One-click cancel and no trial that charges
- Report and block a person in a room
- Lessons that teach an idea, and end with drawing without the guide
- Visible contact and feedback link
- Streak that survives reinstall and cannot be lost by a bug

## Layout score

Not run. `imgdiff.py` compares screenshots of the original against screenshots of the clone at the same viewport and in the same state, and there are no screenshots of the original in `replica/screens/`. The recon worked from public pages only and saved none. The clone side is covered by the browser tests, which keep a screenshot on every failure. No number is given because none was measured. Layout parity with the original is not a goal in any case: its look is its trade dress, and `/replica-brand` changes the colours.

## Behaviour differences (from the recon map and the app's public listings and reviews; the original was not used)

| flow | original does | clone does | fix or keep |
| --- | --- | --- | --- |
| F05 create and join a room | Create, a lobby with a Start step, then the canvas. Free rooms hold 4 people, PRO 10 (help center) | Create, and you are on the canvas at once (you can draw while you wait). Two people. No Start step | keep the shorter path; decide the room size (2 today) |
| F05 who you meet | Rooms with a code, and matching with strangers. Reviews say partners are often bots or replays of past drawings | Invite-only rooms. Every person in a room is a real person who was given the code | keep. This is the angle in `fixes.md` |
| F01 first lesson | Account prompt and a paywall screen early (reviews) | No account, no wall. Straight to the first step | keep |
| F03 lesson access | One free lesson a day or one per course, the rest paid (reviews) | All three lessons free | keep. The clone has 12 steps of content against 2,500 or more |
| Lesson scoring | Several scores (precision, fluency, first try, time) on a 1000-point scale | Accuracy and steadiness, 0 to 100, stars | keep; needs playtesting |
| Energy | Needed to draw; refills over hours or by ads | None | keep (a top complaint) |
| F09 and F06 friends | Friend list, requests, invite by username | None. A friend is whoever you send the code to | build later if wanted (`features.csv`) |
| F11 export | Image, PDF for premium | PNG for everyone | keep |
| Account | Email, Apple or Google sign-in | A guest session, a name, and a delete button | build account linking before anything needs it |
| F02 streak | Daily streak | None | build with the server |

Clicks: first lesson from the home page is Lessons, Start, Start lesson (3). Draw with a friend: Together, Create room, send the code; the friend types it and it joins by itself (about 3 each). The original's count was not measured.

## The top five things to build next

1. **Playtest the lessons with real hands**: the tolerances and the star thresholds are estimates. This decides must-have 2.
2. **The colour stage** of a lesson, the last piece of must-have 1.
3. **Report and block a person in a room.** The table exists, the button does not. Needed before any matching of strangers, and a reviewer of the original names the problem.
4. **Decide how it pays for itself, then write the price page** (`/replica-launch`): the clone is free today and "free" is the angle.
5. **Run it on a real Supabase project and with two real devices** (`replica/backend.md`, "What you have to do", and M-2 in the test plan).

## Next

`/replica-brand` (name, colours, voice, a sweep for anything of the original that is left), then `/replica-launch`. Build 1 to 4 above before launch.
