# Legal pages: where each claim comes from

Written 2026-10-27. The pages are `apps/web/src/pages/Legal.tsx`, served at `/privacy` and `/terms`, linked from the footer on every page. **This is not legal advice.** The pages describe what the code does and the rules you asked for; a lawyer in your country should read them before the site is public (the points that depend on where you live are at the end).

## The rules behind the terms

- **Free for fun.** Personal, recreational use is free. Commercial use (selling access, bundling it in a paid service, collecting its content in bulk) is not covered: ask first.
- **The source code is not free.** `LICENSE` says all rights are reserved, with no licence to copy, modify, publish, resell or build a competing service. Every `package.json` says `"license": "UNLICENSED"`. The terms say the same to people who use the site. The repository must stay **private** or stay unpublished: a public repository with this licence can still be read, but invites copying and gives you little to enforce with.
- **Ads and paid extras may come later.** The first version is free with no ads. The terms and the policy both say that if that changes it is announced on the site first, and the policy is updated before it starts.

## Each statement in the privacy policy, and the code that makes it true

| statement | where it is true | if you change it |
| --- | --- | --- |
| Random guest identity, no email or password | `apps/web/src/data/session.ts` (`signInAnonymously`) | adding sign-in with email or Google changes the first bullet and "we do not ask for your email" |
| Display name, up to 30 characters | `supabase/migrations/0001_identity_rooms.sql` (`display_name` check) and `profile.ts` | |
| Room records stay with the guest profile until deleted or pruned after 30 days idle | `rooms`, `room_members` tables; `prune_guests()` in `0004_jobs.sql` (deleting the auth user cascades) | the rooms table is not cleared when a room expires, only its status changes |
| Lines are deleted about an hour after a room ends, or after a day of no activity | `ENDED_KEEP_MS` (1 hour) and `IDLE_MS` (24 hours) in `apps/realtime/src/room.ts`, then `storage.deleteAll()` | change the policy if either constant changes |
| Internet address: used for limits and the human check, not in the database | `routes.ts` reads `cf-connecting-ip` for rate-limit keys (`Limiter` objects that expire with their window) and passes it to Turnstile | storing IPs in logs or a table changes this |
| Free drawings, progress, theme and sign-in stay in the browser | `autosave.ts` (`penduet.free`), `progress.ts` (`penduet.progress`), `theme.ts`, supabase-js session | |
| No analytics, no tracking cookies, no ads | there is no such code | adding any of them means editing the policy first (see below) |
| No chat | the protocol has no message type for text | |
| Supabase and Cloudflare handle data | `supabase/`, `apps/realtime/` | list any new processor (email sender, error tracker, payment provider) before using it |
| Delete everything in Settings | `deleteMyAccount()` in `profile.ts` calls `delete_my_account()`; cascades to rooms hosted, memberships and attempts | |

## Fill in before the site is public

These are build values, not code. `pnpm preflight` fails until they are set.

1. `VITE_OPERATOR_NAME`: who runs the service (you, or a company). The policy says "run by ..." only when this is set.
2. `VITE_CONTACT_EMAIL`: an address you read. It appears on both pages and in the footer as "Send feedback". Use a role address you can hand over later, not a personal one you want to keep private.

## Questions for a lawyer in your country

- **Who is the controller, and is a representative needed** (EU, UK) if you live outside them.
- **Governing law and courts.** The terms name none on purpose; add the one that applies.
- **Children.** Several places set an age under which parental consent is needed (13 in the US under COPPA, up to 16 in parts of the EU). The pages say a child should draw with an adult and that the site does not knowingly collect children's information; a lawyer should say whether that is enough, since there is no age check.
- **The limit of liability and the "you accept by continuing" clause** depend on local consumer law.
- **Data location.** Say which Supabase region the project is in; the policy does not name one today.
- **A report-and-block tool.** Not built. Some rules for services that let people interact expect a way to report abuse.

## The day ads or analytics are added

Do these in this order, before the first ad is shown:

1. Name the company and what it receives in `/privacy` ("Who else handles it").
2. Update the "No ads" lines: the policy, the terms, the home page hero, the feature card and the Price section, and `listing.json`. Search the code for `no ads` and `ads`.
3. If the ad or analytics tool uses cookies or reads device identifiers, add a consent choice where the law requires one (EU, UK) and make "decline" as easy as "accept". The privacy page's "If ads or analytics come later" section is the promise to keep.
4. Rooms with children: ad networks have special rules for children's audiences. Decide whether ads show inside a room at all.
5. Bump `LEGAL_UPDATED`, and put a notice on the home page.
6. Update `pricing.md` and the test `G-E3` in `e2e/legal.spec.ts`, which currently guards "this first version has no ads".
