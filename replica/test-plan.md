# Test plan: Penduet

Build: working tree after M4 (no git repository yet)  Date: 2026-10-27  Env: local stack, Chrome (Playwright), fake Supabase over the real migrations

Flows covered are the ones the clone has: F01 first lesson, F03 browse and draw a lesson, F05 invite a friend by room code (including lessons together), F11 export. F02 (daily streak), F04 (energy), F06 and F09 (friends), F07 (Quick Play), F08 (Live Session) and F10 (subscribe) are not built (see `features.csv`), so they have no cases. Two extra areas have cases: free draw (S19) and settings (S20).

How to run: `pnpm test:ui` (starts the stack; needs Chrome or Edge, set `PW_CHANNEL=msedge` for Edge). Unit, SQL and Worker tests: `pnpm -r test`. Worker + sockets: `pnpm test:e2e`.

Every UI test also fails on: an uncaught page error, a console error (browser 4xx lines excepted), or any 5xx response. Two people are two browser contexts on different origins, so each has its own guest session.

Types: H happy, E edge, N negative, B regression of a found bug, X cross-cutting, D free draw, S settings, C co-op lesson.

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| **F01 First lesson, F03 Browse and draw a lesson** | | | | | | |
| F01-H1 | first lesson | happy | Lessons, Start, trace all 4 steps, Check, Next, to the end | 3 stars each, summary, list shows best result | UI | |
| F01-E1 | first lesson | edge: refresh mid-lesson | draw, reload | back at the intro, no error | UI | |
| F01-E2 | first lesson | edge: double click on Check | two clicks | one result card | UI | |
| F01-E3 | first lesson | edge: back button mid-lesson | back, forward | list, then intro | UI | |
| F01-E4 | first lesson | edge: phone width | 390 px, start, draw by touch | no sideways scroll, canvas > 300 px, check works | UI @mobile | |
| F01-E5 | first lesson | edge: keyboard only | Tab/Enter through Start and Skip step | lesson finishes, every step "skipped", no progress saved | UI | |
| F01-E6 | first lesson | edge: damaged saved progress | write junk to storage, reload | list loads | UI | |
| F01-N1 | first lesson | negative: wrong drawing | draw far from the guide, Check; Try again; Move on anyway | no pass, 0 stars, attempt wiped, step skipped | UI | |
| F01-N2 | first lesson | negative: nothing drawn | open step | Check disabled until a stroke exists | UI | |
| F03-H1 | browse | happy | open list, open 2nd lesson | 3 lessons, intro with "Draw it with a friend" | UI | |
| F03-E1 | browse | edge: unknown lesson address | /lesson/does-not-exist | message and link back | UI | |
| F03-E3 | draw a lesson | edge: start this step again | step 2 drawn, clear step | step 1 stays, step 2 gone | UI | |
| F03-E4 | draw a lesson | edge: undo across steps | step 2 start | undo disabled until a stroke in this step | UI | |
| F03-E5 | draw a lesson | edge: eraser | erase only, Check | not scored as drawing | UI | |
| F03-E6 | draw a lesson | edge: guide marks | trace 1 of 3 lines, Check | 1 line green, 2 red, hint says part is empty | UI | |
| F03-E7 | draw a lesson | edge: draw again from summary | skip all, Draw it again | step 1, empty canvas | UI | |
| **F05 Invite a friend by room code (S09 S10 S11 S12)** | | | | | | |
| F05-H1 | room | happy | A creates, B joins by code, both draw, B undoes, A ends | live strokes both ways, undo only B's, both see "room has closed", canvas frozen, code cannot be joined again | UI x2 | |
| F05-H2 | room | happy: invite link | B opens /room/CODE | joins | UI x2 | |
| F05-E1 | room | edge: messy code | " ab - cd23 " lowercase, dash, spaces | accepted | UI x2 | |
| F05-E2 | room | edge: no such room | ZZZZZZ | message, stays, clears on typing | UI | |
| F05-E3 | room | edge: room full | third person by code and by link | "already has two people", no canvas | UI x3 | |
| F05-E4 | room | edge: reload mid-room | A reloads | drawing comes back, B sees no leave | UI x2 | |
| F05-E5 | room | edge: two tabs, same person | second tab opens the room | first tab says moved, "Use this tab" takes it back | UI x2 | |
| F05-E6 | room | edge: guest leaves | B Leave | A told, A keeps room and can draw | UI x2 | |
| F05-E7 | room | edge: host leaves | A Leave | B becomes host and sees End room | UI x2 | |
| F05-E8 | room | edge: connection drops | cut B's socket | banner, drawing paused, back by itself, A's stroke arrives | UI x2 | |
| F05-E9 | room | edge: malformed code in address | /room/ZZ | "does not look like a room code", link back | UI | |
| F05-E10 | room | edge: closed room address | /room/ZZZZZZ | "room has closed", no canvas | UI | |
| F05-E11 | room | edge: double click Create | two clicks | one room (two more allowed, fourth refused) | UI | |
| F05-N1 | room | negative: fourth open room | create 3, then 1 | plain message, stays | UI | |
| F05-N2 | room | negative: stranger | token of a stranger asks for ticket / end | 404 both, room untouched | UI + API | |
| F05-N3 | room | negative: undo partner's stroke | B's undo after A drew | disabled | UI x2 | |
| F05-B1 | room | regression BUG-003 | A draws area shifts when B joins/drops/returns | canvas top edge never moves | UI x2 | |
| F05-B2 | room | regression BUG-002 | A holds a stroke open while B joins | B sees it, also after reload | UI x2 | |
| F05-B3 | room | regression BUG-003 (second cause) | long name vs short name, 1280 and 390 px, partner joins, drops, returns | canvas top edge never moves | UI x2 | |
| **F05b Lesson together** | | | | | | |
| C-H1 | lesson room | happy | A creates for a lesson, B joins, A draws, B checks, A next | same step, same card, strokes frozen during result | UI x2 | |
| C-E1 | lesson room | edge: start step again | B Try again | both cleared, drawing works | UI x2 | |
| C-E2 | lesson room | edge: both press Next | at once | one step | UI x2 | |
| C-E3 | lesson room | edge: reload on result | reload | same card and marks | UI | |
| C-E4 | lesson room | edge: finish | alternate drawers through 4 steps | summary for both, progress saved on both, Draw it again resets | UI x2 | |
| C-E5 | lesson room | edge: skip | B Skip step, then skip all | cleared, all "skipped" | UI x2 | |
| C-E6 | lesson room | edge: undo | both draw, B undo | only B's | UI x2 | |
| C-E7 | lesson room | edge: free room | create without lesson | no lesson UI | UI | |
| C-E8 | lesson room | edge: from lesson page | "Draw it with a friend" | room for that lesson | UI | |
| **D Free draw (S19), F11 Export** | | | | | | |
| D-H1 | free draw | happy | pen, colour, size, undo, eraser, clear (cancel, then confirm) | each takes effect | UI | |
| D-H2 | free draw | happy: undo | undo to empty | disabled at start and end | UI | |
| D-E1 | free draw | edge: refresh | draw, reload | picture back | UI | |
| D-E2 | free draw | edge: damaged save | junk in storage | empty canvas | UI | |
| D-E3 | free draw | edge: click without moving | click | dot | UI | |
| D-E4 | free draw | edge: leave the canvas mid-stroke | drag out and back | stroke continues, canvas still works | UI | |
| D-E5 | free draw | edge: keyboard | arrows, Home/End, Enter, Escape | focus moves; panel closes and focus returns | UI | |
| D-E6 | free draw / F11 | edge: export | Save as image | PNG with the drawing | UI | |
| D-E7 | free draw | edge: long stroke | 200 points | no freeze | UI | |
| **S Settings (S20)** | | | | | | |
| S-H1 | settings | happy: rename | save "Mara", open a room | partner sees Mara | UI x2 | |
| S-E1 | settings | edge: empty name | spaces, save | message, nothing saved | UI | |
| S-E2 | settings | edge: 50 characters | type | stops at 30 | UI | |
| S-E3 | settings | edge: accents and emoji, 390 px | save, open room | kept, no overflow | UI | |
| S-E4 | settings | edge: spaces around | "   Teo   " | trimmed | UI | |
| S-H2 | settings | happy: delete my data | cancel, then confirm | session gone, hosted room gone for others, new guest next time | UI x3 | |
| **API and security (Worker)** | | | | | | |
| API-N1 | API | no token / junk token | 5 routes | 401 | API | |
| API-N2 | API | token of a deleted account | forged | 401 | API | |
| API-N3 | API | bad bodies | not json, bad slug, oversize, bad codes | 400 | API | |
| API-N4 | API | unknown route, wrong method | | 404, 405, health 200 | API | |
| API-N5 | API | error contents | join missing room | only `room_not_found`, no token echo | API | |
| API-N6 | API | CORS | allowed and foreign origins | only ours get headers | API | |
| API-N7 | API | socket handshake | valid, forged, other room's ticket, none | only valid opens | API + UI | |
| API-N8 | API | ticket tampering | extend `exp` | 401 | API | |
| API-N9 | API | code guessing | 80 guests from one address | 429 with Retry-After | API (last) | |
| API-N10 | API | room creation limits | 14 creates by one user | 3 ok, rest 429 | API (last) | |
| **X Cross-cutting** | | | | | | |
| X-1 | all | console | every spec | no console error, page error or 5xx | UI | |
| X-2 | all screens | axe scan, light and dark | 9 pages + lesson drawing, result, live room, dialogs, panels | 0 violations | UI | |
| X-3 | all screens | no sideways scroll at 390 px; touch targets at least 44 px | 9 pages + rooms | none | UI @mobile | |
| X-4 | all | page titles | each page | present, distinct | UI | |
| X-5 | all | skip link, focus on navigation, announcement | Tab, Enter; click a nav link | skip link first; focus and announcement move | UI | |
| X-6 | all | theme persists | Dark, reload, Auto | kept | UI | |
| X-7 | rooms hub | keyboard | Tab to Create room, Enter | room opens | UI | |
| X-8 | lessons, rooms | canvas fits 1280x720 | free draw, lesson, room, lesson room | whole square on screen | UI | |
| **Manual (needs hardware or accounts)** | | | | | | |
| M-1 | free draw | real pen: pressure and palm rejection | iPad with pencil, draw with palm resting | line weight follows pressure; palm ignored | manual | not run |
| M-2 | rooms | two physical devices on different networks | create, join, draw, mobile data and wifi | live both ways, reconnect on network change | manual | not run |
| M-3 | all | screen reader pass (NVDA or VoiceOver) | rooms hub, lesson, room | names, live announcements make sense | manual | not run |
| M-4 | rooms | real Supabase project | `curl` a create with a real guest token | same answers as the fake | manual | not run |
| M-5 | rooms | real Turnstile widget | site and secret keys | token accepted, bad token refused | manual | not run |
| M-6 | rooms | slow network | throttle to 3G | strokes still arrive in order, banner on drop | manual | not run |
| M-7 | rooms | seat held after tab close | close B's tab, C tries to join | room full (known gap) | manual | not run |
