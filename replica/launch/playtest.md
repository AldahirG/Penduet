# Playtest kit: ten pairs

Written 2026-10-27. Goal: find out where two real people get stuck, before anyone is told about the product. This is the "ten pairs, by hand" step of `launch-plan.md`.

## Is it ready?

```bash
pnpm preflight
```

It prints OK, WARN or FAIL for each thing a playtest link needs and exits 1 if any FAIL is left. Today every FAIL is "not deployed yet": there is no real Supabase project, Worker or site address. That is what `/replica-deploy` does, and it needs accounts only you can create. Until then the app runs locally (`pnpm dev:local`), which is enough to test with one person at your own screen, not to hand a link to a friend.

What the playtest needs, in order:

1. A Supabase project with the migrations pushed (`pnpm db:push`), anonymous sign-ins on, backups on.
2. The Worker deployed (`wrangler deploy` with its secrets), `ALLOWED_ORIGINS` set to the site's origin.
3. The site built with the `VITE_*` values from `apps/web/.env.example`, including `VITE_OPERATOR_NAME` and `VITE_CONTACT_EMAIL`, and put on a host. Cloudflare Pages is the least work, since the Worker is already there.
4. `pnpm preflight` says "Ready".
5. One dry run: you on a laptop and a phone, different networks, a room with a lesson, a dropped connection (airplane mode for ten seconds), "Save as image".

## Who

Twenty people in ten pairs from your own contacts, in different places: two friends, a couple, siblings, a parent and an older child, a teacher and a pupil. A mix of mouse, finger and pen. At least two pairs who have never used a drawing app, and at least one who has. Tell them it is an early version and that you are testing the app, not them.

Children: only with a parent present and only with the parent's say-so. The site has no age check and no report button.

## Before each session

- Say what you will note down and that you may record the screen if they agree. No recording without a yes. Delete recordings you do not need.
- Give them **only the link**. No instructions. One of them opens it, and you do not say how to start.
- Ask them to talk aloud. Do not help for the first two minutes.

## What to watch

| moment | what you are looking for |
| --- | --- |
| Landing | do they find "Start a room" without help? what do they think the product is, in their words? |
| Making the room | do they notice the code and the invite link? which one do they send? how? |
| Second person joining | can they get in without help? do they type the code, or open the link? how long from "send" to "in"? |
| First minute drawing | do they see each other's lines? do they try anything that does not exist (chat, a cursor, a ruler, layers)? |
| A lesson together | do they understand the dashed guide? who checks? what do they make of the score and stars? |
| Trouble | a dropped connection, a wrong code, a full room: do they read the message? do they know what to do? |
| End | do they save the picture? do they say they would do it again, with whom? |

## Questions afterwards (five minutes)

1. What were you trying to do?
2. What did you expect to happen when you pressed the button you hesitated on?
3. What was the best moment? The worst?
4. Would you send the link to someone? Who, and what would you say?
5. If this cost money, what would it be fair for it to cost? (Only to collect an answer. It is not a promise.)

## Notes template

One file per round, with a date, and the pair's first names only (no surnames, no contact details):

```
Pair 3 (2026-11-02)  Ana + Luis, laptop + phone, first time with a drawing app
Link to second person: sent a screenshot of the code in a chat. In after 40 s.
Stuck at: ...        (what, how long, what they tried)
Said: "..."          (exact words, with a time if recorded)
Expected: ...
Bug seen: ...        (steps to repeat; file it in replica/bugs.md if it is real)
Would send it to: ...
```

## What counts as a result

- **Did the second person get in without help?** Nine of ten pairs is the bar. Fewer means the invite flow is the problem, not the marketing.
- **Did both people draw within the first two minutes?**
- **Anything three pairs tripped over** is the next thing to fix. One pair's odd habit is a note, not a task.
- **Bugs** go into `replica/bugs.md`; S1 and S2 are fixed before the next pair.

## Measuring from the database

No analytics code is needed. From the Supabase SQL editor, per day or week:

```sql
-- rooms created
select count(*) from rooms where created_at > now() - interval '7 days';

-- rooms where a second person joined, and how fast
select r.code, r.created_at,
       min(m.joined_at) filter (where m.role = 'guest') - r.created_at as time_to_second
from rooms r join room_members m on m.room_id = r.id
where r.created_at > now() - interval '7 days'
group by r.id having count(*) >= 2;
```

Errors in the browser are not collected anywhere, so the sessions are the only way a crash is noticed. Worker errors show in the Cloudflare dashboard.

## After the ten pairs

Write what you learned at the top of `replica/launch/launch-plan.md` (what broke, what confused, what people asked for), fix the top three, and only then think about showing it to more people.
