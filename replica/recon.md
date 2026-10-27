# Recon map: ArtWorkout (iOS / iPad / Android app + marketing site)

Scope: the core loop (guided drawing lessons with stroke feedback) and the "Draw Together" multiplayer (rooms, invites, shared canvas). Retention and monetisation are mapped but are not the focus.
For: the user's own product. Starting as a 2-person co-op drawing app (see `PLAN.md`), rebranded before launch.
Date: 2026-10-26

**How this map was made.** Public pages only: the marketing site, the method page, the download page, the help center, the App Store listing, a blog post and press coverage. No account was used, no app was installed, no screenshots of in-app screens were taken. So **every in-app screen below is inferred from text, not seen**. Confidence is marked on each row. A walkthrough of the real app by the user (their own account, at human speed) would raise most "guess" rows to "high". Put those screenshots in `replica/screens/`.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | marketing home (ES) | https://artworkout.app/es | pitch, course cards, FAQ, claims (75M users, 3,000+ lessons) |
| 2 | method page | https://artworkout.app/es/method | staged drawing, score fields; no algorithm detail |
| 3 | download page | https://artworkout.app/es/download | QR download, "start free with daily energy", 12 languages |
| 4 | help center | https://artworkout.app/faq/ | multiplayer limits, account, parents, modes. Summarised by a fetch tool, so treat as medium confidence (some answers read generic) |
| 5 | App Store listing | https://apps.apple.com/us/app/id1564657118 | most detailed source: Draw Together, PRO, price list, 8 recent changelog entries |
| 6 | blog: drawing feedback | https://artworkout.app/blog/advice/how-to-use-drawing-feedback-without-chasing-a-perfect-score | confirms feedback exists; no scoring detail |
| 7 | blog index | https://artworkout.app/blog | tutorial and advice posts; nothing on multiplayer |
| 8 | press: GeekWire | https://www.geekwire.com/contributor-content/artworkout-the-ipad-drawing-app-that-teaches-you-how-to-draw-in-15-minutes/ | promo copy |
| 9 | press: Inverse | https://www.inverse.com/tech/how-5-minute-learn-how-to-draw-artworkout-app-uses-micro-learning-to-make-creativity-easier | micro-learning framing |
| 10 | search snippet: help center / changelog | web search results | "Profile tab, friends, lobby invites", "Live Session mode" (preselected lesson for all), player limits |
| - | Google Play listing | https://play.google.com/store/apps/details?id=app.artworkout.learn.how.to.draw | **not read**: fetch returned truncated content. Retry or read by hand |

Conflicts between sources (resolve with the real app):
- Player limit: help center says free up to 4, Premium up to 10; App Store says "unlimited multiplayer" is PRO. Likely both true (limit per room vs access). Unverified.
- Lesson count: 3,000+ (site) vs 3,500+ (App Store). Marketing numbers, ignore.
- Help center says lessons can be "paused, rewound"; the method page describes interactive stroke-by-stroke drawing, not video. Treat the help center line as generic text.
- "Chameleon" (hide-and-seek multiplayer mode) appears only in the App Store changelog (v1.14.6). No rules published.

## Core loop

Do a short guided drawing lesson (10 to 20 min), get instant stroke feedback, come back daily; and draw the same lesson or canvas live with a friend or stranger in a room.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Onboarding | first launch | pick goal and level, set daily habit | goal chips, level picker, CTA | guess: all, not seen |
| S02 | Home / Today | tab bar | today's lesson, streak, daily goal, energy | lesson card, streak badge, energy meter, course shelf | filled, energy empty (guess) |
| S03 | Course catalog | tab bar | browse courses (Doodling, Sketching, Drawing, Painting, Handwriting, Lettering) | course card with level + lesson count | filled, locked (PRO) |
| S04 | Course detail | tap a course | lesson list, level, "you will learn" | lesson row, progress, lock icon | partial, completed, locked |
| S05 | Lesson start | tap a lesson | pick mode (Relax / Learn / Draw per help center) and difficulty | mode selector, difficulty, start CTA | guess |
| S06 | Lesson canvas | start a lesson | guided drawing in stages (lines, shapes, details, colour) with live guide | canvas, guide overlay (magnetic tracing since v1.14.11), step bar, toolbar (undo, brush, colour), pause | drawing, step done, off-guide hint |
| S07 | Lesson result | finish a lesson | score card: precision, fluency, first try, time | score rows (e.g. 975/1000, 272/300, 50/50, 04:01), stars (guess), replay, next | success, retry |
| S08 | Gallery | profile or tab | saved drawings, review progress, export | grid, export sheet (image; PDF/other for Premium per help center) | empty, filled |
| S09 | Multiplayer hub | tab bar | entry to Quick Play, Live Session, create room, join by room code | mode cards, code field | free vs PRO gated |
| S10 | Lobby | create/join room | wait for players, invite by username or code, pick lesson | player list, room code, invite button, start | waiting, full, countdown (guess) |
| S11 | Multiplayer canvas | room starts | shared canvas, or same lesson side by side | canvas, peer cursors/strokes, player chips, toolbar | drawing, peer left, reconnect (guess) |
| S12 | Multiplayer result | room ends | show finished drawing, scores, share | image, score rows, share, play again | guess |
| S13 | Chameleon mode | multiplayer hub | hide-and-seek style game | unknown | **unseen**, rules unknown |
| S14 | Profile | tab bar | username, achievements, streak, friends, subscription | avatar, username, badge grid, settings link | filled |
| S15 | Friends | profile tab | add friend by username, requests, invite to lobby | search field, request rows, invite action | empty, filled |
| S16 | Notifications | system push + in-app | friend requests, lobby invites (v1.14.11) | accept/decline rows | filled |
| S17 | Paywall | gated lesson, energy, PRO feature | sell PRO, free trial, plan list | plan cards (weekly/monthly/yearly), CTA, restore | trial, expired |
| S18 | Energy empty | start lesson with 0 energy | wait, watch ad, or subscribe | modal, timer, ad CTA, paywall CTA | per reviews and FAQ; details unseen |
| S19 | Sandbox / free draw | tab or menu | free drawing with brushes, pixel drawing mode (v1.14.6) | canvas, brush picker, colour picker | guess |
| S20 | Settings | profile | account, language (12), dark mode, notifications, Screen Time blocking | list rows | filled |
| S21 | Auth | sign up / log in | email, Apple ID, Google (help center) | provider buttons, email form | error states guess |
| S22 | Parent dashboard | parent's corner | child progress, daily limits | charts, time-limit schedule | **low confidence**, from help center only |
| S23 | Web: home | /es | marketing, social proof, courses, FAQ, CTA | hero, stats, creator carousel, FAQ accordion | observed |
| S24 | Web: method | /es/method | explain staged teaching and score | step diagram, score screen mock | observed |
| S25 | Web: download | /es/download | QR to the stores | QR code, language selector | observed |
| S26 | Web: blog | /blog | SEO tutorials and advice | post cards, "show more" | observed |
| S27 | Web: help center | /faq | FAQ by category | accordions | observed |

## Flows

```
F01 First run: new user finishes first lesson
    S01 -> (S21) -> S02 -> S05 -> S06 -> S07 -> S17 (soft paywall)
    happy path clicks: not measured
    edge: skip account, offline, no energy

F02 Daily lesson (habit loop)
    S02 -> S05 -> S06 -> S07 -> S02 (streak +1)
    edge: streak broken, streak restore (changelog 1.14.10), energy empty

F03 Browse a course and draw a lesson
    S02 -> S03 -> S04 -> S05 -> S06 -> S07
    edge: locked lesson -> S17

F04 Out of energy
    S05 -> S18 -> (wait | watch ad | S17)

F05 Invite a friend by room code  (core of the co-op)
    S09 -> S10 (create, code shown) -> friend: S09 (enter code) -> S10 -> start -> S11 -> S12
    edge: wrong code, room full (4 free / 10 PRO per help center), host leaves, peer disconnects

F06 Invite a friend by username
    S14 -> S15 (find user) -> invite -> S16 (friend accepts) -> S10 -> S11
    edge: friend offline, declined, already in a room

F07 Quick Play with strangers
    S09 -> matchmaking -> S10 -> S11 -> S12
    edge: no one found, someone leaves, abusive content (App Store lists user-generated content)

F08 Live Session
    S09 -> S10 (lesson preselected for everyone) -> S11 -> S12

F09 Add a friend
    S14 -> S15 (send) -> S16 (accept) -> friend list

F10 Subscribe
    S17 -> store purchase sheet -> unlock -> S02
    edge: restore, cancel (Profile -> Subscription per help center), trial ends

F11 Export artwork
    S08 -> export sheet -> image (PDF for Premium)
```

Click counts were not measured (no app access). Measure F01, F02 and F05 in the real app; those are the numbers to beat.

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger | default, pressed, disabled, loading | all |
| Tab bar | 4 to 5 tabs (guess: Home, Courses, Multiplayer, Profile) | selected, badge | S02-S16 |
| Energy meter | bolt + count | full, low, empty, refilling | S02, S05, S18 |
| Streak badge | flame + days | active, broken, restored | S02, S14 |
| Course card | by level, locked | default, locked, in progress | S02, S03 |
| Lesson row | numbered | locked, current, done | S04 |
| Step progress bar | segmented by stage | current, done | S06 |
| Drawing canvas | solo, shared | idle, drawing, replaying | S06, S11, S19 |
| Guide overlay | ghost line, magnetic snap | visible, hit, off-guide | S06, S11 |
| Drawing toolbar | undo, redo, brush, colour, eraser | active, disabled | S06, S11, S19 |
| Brush picker | list with previews | selected | S19, S06 |
| Colour picker | palette, mixer (colour-mixing lessons v1.14.16) | selected | S06, S19 |
| Score card | rows with value/max | revealing, final | S07, S12 |
| Player chip | avatar + name + status | online, drawing, left | S10, S11 |
| Room code field | 6-char entry and display | empty, invalid, valid | S09, S10 |
| Friend row | with invite action | online, offline, pending | S15 |
| Modal / sheet | paywall, energy, confirm | open | many |
| Toast / banner | invite, error | info, error | many |
| Achievement badge | locked/unlocked | | S14 |
| Language selector | 12 languages | | S20, S25 |

## Inferred data model

```
User         id, username (custom, v1.14.1), display_name, avatar, locale, created_at, is_guest
             evidence: S14, S21, changelog 1.14.1, help center "create an account"
             confidence: high
AuthIdentity user_id, provider (email | apple | google)
             evidence: help center Account section
             confidence: medium
Friendship   user_a, user_b, status (pending | accepted | blocked), created_at
             evidence: S15, S16, changelog 1.14.11
             confidence: high
Course       id, title, level, lesson_count, category, locale
             evidence: S03, S23
             confidence: high
Lesson       id, course_id, title, difficulty, est_minutes, is_premium
             evidence: S04, S23
             confidence: high
LessonStep   id, lesson_id, ordinal, stage (lines | shapes | details | colour), guide_paths (vector), tolerance
             evidence: method page (stages), "magnetic guidance"
             confidence: medium (structure inferred)
Attempt      id, user_id, lesson_id, precision, fluency, first_try, duration_s, stars?, created_at
             evidence: S07 score mock (975/1000, 272/300, 50/50, 04:01)
             confidence: high for fields, guess for stars
Artwork      id, user_id, source (lesson | free | room), image_url, strokes (json), created_at
             evidence: S08, help center export
             confidence: medium
Room         id, code, host_id, mode (quick | live | friends | chameleon), lesson_id?, capacity, status, created_at
             evidence: help center (room code, 4/10 limit), changelog (Live Session, lobby)
             confidence: medium
RoomMember   room_id, user_id, role, joined_at, left_at
             confidence: medium
Stroke       id, room_id, author_id, tool, color, size, points, seq
             evidence: "draw together in real time on a shared canvas"; transport and format unknown
             confidence: guess
Subscription user_id, plan (weekly | monthly | 3-month | yearly), status, trial_end, store (apple | google)
             evidence: App Store price list, help center
             confidence: high
EnergyBalance user_id, amount, refilled_at
             evidence: home FAQ, download page ("free daily energy")
             confidence: medium (rules unknown)
DailyGoal / Streak user_id, day, completed, streak_len
             evidence: changelog 1.14.1, 1.14.10, 1.14.17
             confidence: high
Achievement  id, user_id, unlocked_at
             evidence: changelog 1.14.1
             confidence: medium
Notification user_id, type (friend_request | lobby_invite), payload, read_at
             evidence: changelog 1.14.11
             confidence: high
ParentLink   parent_id, child_id, daily_limit, allowed_hours
             evidence: help center Parent's corner only
             confidence: guess
```

Relationships: User 1-n Attempt, User 1-n Artwork, User n-n User (Friendship), Course 1-n Lesson, Lesson 1-n LessonStep, Room 1-n RoomMember, Room 1-n Stroke, User 1-1 Subscription, User 1-1 EnergyBalance.

## Feature matrix

See `features.csv`. Counts after the first pass: must 14, should 13, could 8, skip 8 (see the file for exact rows).

## Out of scope (cannot or should not be cloned)

- Lesson content and illustrations as made by their artists, and licensed collections (e.g. the Winx Club collection, v1.14.6). Author your own lessons.
- Their network: 75M users, creator and TikTok partnerships, the community, the Discord.
- The proprietary stroke-analysis algorithm. Build your own scoring from the plan's accuracy + smoothness idea.
- Brand, name, logos, mascot, copy, fonts, screenshots.
- Platform-specific pieces for a first release: Apple Pencil pressure tuning, Siri/Shortcuts, Screen Time blocking, store-level subscriptions.
- Ad network and ad-based energy refill.
- Child-safety regimes (parent dashboard, 6+ audiences) carry legal duties (COPPA/GDPR-K); do not ship to children without them.

## Size

Screens 27 (22 in-app, 5 web), flows 11, entities 16. Hard parts:
1. Realtime shared canvas with presence, rooms, reconnect, and matchmaking/moderation once strangers are allowed.
2. Guided drawing engine: guide overlay, magnetic snapping, per-stroke scoring that feels fair.
3. Lesson content: thousands of authored lessons are the real moat, so plan an authoring tool.
Also: subscriptions via the stores, and a child-safe community.

Size: the whole app is XL (rescope). The slice in `PLAN.md` (rooms, shared canvas, a few lessons) is M.
