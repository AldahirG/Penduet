# Launch plan: Penduet

Written 2026-10-27. Nothing below has been done. The product is a web app that runs locally; it has not been deployed, has never met a real person, and has not run on a real Supabase project.

## The one-line plan

Get ten pairs of real people to draw together for ten minutes while you watch, fix what breaks, then show two people drawing together, in short videos, to the people who are tired of the alternatives.

## Gates before anything public

Each is a thing that stops a launch if it is not true. Most are in other files.

| gate | state | where |
| --- | --- | --- |
| The name is cleared (trademark in the US, EU, Canada; Google Play; handles) | **not done** | `brand.md`, "Checks" |
| Runs on a real Supabase project and a real Cloudflare account, with two real devices | **not done** | `backend.md`; test plan M-2 and M-4 |
| Deployed on your own domain, with backups on, Turnstile on, `ALLOWED_ORIGINS` set | **not done** | `/replica-deploy` |
| Privacy policy and terms, listing every processor (today: Supabase, Cloudflare) | **written, built, linked from the footer** (a lawyer should read them; operator name and contact address still to set) | `legal-notes.md` |
| The lessons have been drawn by real hands, and the scoring thresholds adjusted | **not done** | `parity.md`, build item 1 |
| A way to report and block a person | **not built** (the table exists) | `fixes.md`, fix 4. Invite-only rooms lower the risk, which is why it is not a hard gate for a first small launch, but it is one before any public promotion |
| The pricing decision (stay free, or Plus) | **decided for v1: free, no ads; ads may come later, announced first** | `pricing.md` |
| Logo, social image, app icon | **five concepts drawn, none chosen** (`replica/design/logo/index.html`); social image and app icon wait for the choice | `brand.md` |
| The "Design" link removed from the navigation, a footer with the policy links | **done** (the `/design` page now exists only in development builds) | `landing.md` |
| The project folder renamed | **not done** (close the session, rename `ArtWorkout` to the product name) | `brand.md` |
| Playtest kit and a preflight check | **written** (`pnpm preflight`, `playtest.md`) | `playtest.md` |

## Before launch

**A list of people.** A page with one field (an email) for "tell me when it is ready" is enough. There is none today. Decide where the addresses live and say so in the privacy policy.

**Ten pairs, by hand.** Twenty people: friends, siblings, couples, a teacher and a pupil, from your own contacts. Give each pair nothing but a link. Watch the first two minutes of at least five pairs, in person or on a call, without helping. Write down where they stop. The questions that matter: did the second person get in without help; what did they do first; did anyone try something that does not exist.

**Measure from the database, not an analytics script.** The `rooms` and `room_members` tables already hold what is needed, so no tracking library has to be added (and the privacy policy stays shorter). From the SQL editor, weekly:

- Rooms created: `select count(*) from rooms where created_at > now() - interval '7 days'`
- Rooms where a second person joined: rooms with two `room_members` rows
- Of those, the share where the second person joined within 10 minutes of creation (this is the activation number: it says the invite worked)
- Rooms that came back: pairs (the same two user ids) in more than one room in a week

What this cannot tell you: where people click, which lessons are abandoned. If those matter, pick a privacy-light tool then, and add it to the policy first.

**Errors.** Worker errors can be read in the Cloudflare dashboard. Errors in the browser are not collected anywhere today. Decide on an error tracker (and add it to the privacy policy) before real users; otherwise the ten-pairs sessions are the only way a crash is ever noticed.

## Where the original's unhappy users are

What the research supports, and what it does not:

- **Short videos of two people drawing.** Two of the reviews of the original say they came for what the videos and ads showed: "2 player drawings" in short videos, and ads that "led me to believe you actively drew with other people". That is the original's own acquisition channel, and its reviewers say the product did not match. A real clip of two real people drawing together, with the second person's lines appearing, is the honest version of the same promise. Make the first ten clips from the ten-pairs sessions, with permission.
- **The stores.** People read reviews there before they download. The reviews at the top of the original's listing are the complaints in `fixes.md`. Your own listing's first lines (see `listing.json`) answer them: no bots, no ads, no energy. Do not reply to their reviews or post under them.
- **Their own community pages** (the original's Play listing names Discord and Telegram): do not advertise in someone else's community.
- **Reddit and similar threads: not researched.** Reddit blocked the tools used here, so no thread was read, and nothing about subreddits is claimed. A person should search the category by hand ("draw with friends", "alternative to ...") and note the threads with dates before posting anywhere.

## The launch post

**Show HN or Product Hunt**, whichever you will answer comments on for a day. Lead with the fix, not the feature list.

> Penduet: draw on one canvas with a friend. You open a room, send a six-character code, and you see each other's lines live. Every person in a room is a real person who got the code: no bots, no ads, no energy meter. Web app, no account. It is early: two-person rooms, twenty-seven lessons on three levels, three games for two (two halves of one picture, a shared topic, and pass the pen), nothing paid.

Be ready for: "how is this different from PairDrawing" (a real, existing app in the same niche: the answer is lessons you do together, no ads, and the web; check the claim against the app before posting), "is it open source" (no: the code is private and all rights are reserved; the service is free for personal use, see `legal-notes.md`), "how do you make money" (answer from `pricing.md`, honestly: it does not yet).

## The first ten users to talk to

Ten pairs from the section above. After each session, ask: what were you trying to do; what did you expect to happen when you pressed the button you hesitated on; would you send the link to anyone, and who. Keep notes in one file, with a date and the pair's first names only.

## Store listings

`listing.json` is a draft and passes `listing.py` (0 errors, 0 warnings). **The product is not in either store.** It is a web app. Putting it there means a wrapper app (or a rebuild), store accounts, screenshots at the sizes the stores require on the day, a privacy label and a data safety form, an age rating, and review notes. The review notes can say: "No account is needed. The app starts you as a guest. To see two people drawing, open a room in one browser and join with the code in another." Apple's rule 4.1 on copycats: your visible differences are the real two-person rooms, the lessons you do together, and no ads or energy, so show them in the first screenshots.

## After launch: the first month

- Week 1: read every session note; ship fixes daily.
- Week 2: look at the activation number. If fewer than half of rooms get a second person within ten minutes, the invite flow is the problem, not the marketing.
- Week 3: the second most-asked-for thing becomes the next feature (see `fixes.md`: report and block, lessons that teach).
- Week 4: decide the pricing question with real numbers (how many pairs return; what they ask for).
