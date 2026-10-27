# What users of the original say, and what to do about it

## The sample, stated plainly

**920 reviews from 2 sources.** The skill asks for 100+ reviews from at least 3 sources. This is 2.

| source | rows | how |
| --- | --- | --- |
| Apple App Store | 900, with star ratings | Apple's public customer-reviews RSS feed, 3 pages (50 each) for each of 6 storefronts: US, UK, Canada, Australia, Spain, Mexico. Most recent first, dated 2025-11-01 to 2026-10-26. 311 are 5 star, 130 four, 126 three, 98 two, 235 one |
| Google Play | 20, no star ratings | read by hand in the browser from the listing's review list ("Most relevant"). The page shows stars as pictures, so the rating column is empty, and all 20 are unrated |

What was tried and did not give data: Hacker News (one hit for "artworkout", a different app, nothing used), Reddit (the site blocks scripts, and the browser pane refuses it), Trustpilot (nothing found by search). Third-party review aggregators turned up in search; they are not first-hand, so none of their text is in the sheet.

Limits to keep in mind:
- The App Store feed gives only the newest reviews, not all of them. These 900 average 3.2 stars. The Google Play listing shows 4.5 across hundreds of thousands of ratings. So recent written reviews are harsher than the long-run average, and people who write reviews are not all users. Do not read the percentages below as the share of all users.
- Themes are keyword matches (English and Spanish, `replica/themes.json`), not hand coding. A review can match several themes. I read samples of the matches for each angle I use below (6 to 8 each) and they were on topic, but the counts are approximate.
- The App Store link on each row is the feed's link to the reviewer's page, not to a page that shows only that review. Google Play rows all link to the listing.
- Some reviewers are children (a few say their age or that their parents control the money). That is part of the picture, not noise.

## 1. What they hate

Ranked by the tool's score (low ratings and recent reviews weigh more). Counts are reviews matching the theme out of 920. The "1 and 2 star" column is the share of the 333 one and two star reviews.

| # | problem | reviews | 1-2 star | sources | avg stars |
| --- | --- | --- | --- | --- | --- |
| 1 | **Almost nothing is free.** The free version cannot really be used: one drawing, then a trial screen | 339 (37%) | 171 (51%) | 2 | 2.6 |
| 2 | **Ads**, including having to watch several to get one go | 238 (26%) | 102 (31%) | 2 | 2.8 |
| 3 | **Energy** that runs out, with waits of hours | 182 (20%) | 69 (21%) | 2 | 2.9 |
| 4 | **Billing**: trials that charge, cancelling that does not stop the charges | 73 (8%) | 48 (14%) | 2 | 2.2 (the lowest of any theme) |
| 5 | **Multiplayer is not what the ads showed**: partners that are bots or replays, and no way to draw with people you know | 65 (7%); about 20 of them name bots, AI or replays | 20 (6%) | 2 | 3.0 |
| 6 | Drawing tools: no brushes or colour wheel, an eraser behind the paywall, needing an Apple Pencil | 28 (3%) | 10 | 2 | 2.9 |
| 7 | Too strict: tracing and colouring in, "not learning to draw" | 25 (3%) | n/a | 2 | 4.0 |
| 8 | Not enough to do: boring, the same few drawings | 15 (2%) | n/a | 2 | 2.5 |
| 9 | Strangers: inappropriate drawings, children | 18 (2%) | n/a | 2 | 4.2 |
| 10 | Bugs and crashes | 11 (1%) | n/a | 2 | 3.3 |

Quotes (verbatim; links as in the sheet):

1. "This app is technically free, but you have to pay to do ANYTHING, and I mean that." ([Google Play](https://play.google.com/store/apps/details?id=app.artworkout.learn.how.to.draw&hl=en&gl=us&showAllReviews=true)). "Why is every thing with money and why is the eraser with money like WHY" ([App Store, 1 star](https://itunes.apple.com/es/reviews/id417173022)).
2. "You need to watch SO MANY adds to just get ONE ENERGY it’s such a waste and is not worth it ngl" ([App Store, 3 stars](https://itunes.apple.com/au/reviews/id1324103764)).
3. "Then your cant draw for the next 24 hrs because you are ‘ out of energy’ if you watched 1 ad for one picture, it would be 4 stars." ([App Store, 2 stars](https://itunes.apple.com/au/reviews/id1602845184)). "you need energy to draw and my energy wouldn't increase no matter the amount of days." ([Google Play](https://play.google.com/store/apps/details?id=app.artworkout.learn.how.to.draw&hl=en&gl=us&showAllReviews=true)).
4. "even after canceling the subscription they've still been trying to take 50$ from me." ([Google Play](https://play.google.com/store/apps/details?id=app.artworkout.learn.how.to.draw&hl=en&gl=us&showAllReviews=true)). "I don’t remember saying I was going to pay $100 for it. I never did. And I would like my money back because it took it out of my mother’s account not mine." ([App Store, 1 star](https://itunes.apple.com/au/reviews/id1589377390)).
5. "its just drawings people did in the past being replayed along you drawing." ([Google Play](https://play.google.com/store/apps/details?id=app.artworkout.learn.how.to.draw&hl=en&gl=us&showAllReviews=true)). "And i wanted to play wth actually people but im pretty sure im playing wth bots." ([App Store, 4 stars](https://itunes.apple.com/us/reviews/id1927836532)). "you also can't draw with people you know on here!!" ([Google Play](https://play.google.com/store/apps/details?id=app.artworkout.learn.how.to.draw&hl=en&gl=us&showAllReviews=true)).
6. "This stupid app is only usable if you have a apple pen." ([App Store, 1 star](https://itunes.apple.com/gb/reviews/id1953986906)).
7. "It doesn't teach any basics for making original drawings" ([Google Play](https://play.google.com/store/apps/details?id=app.artworkout.learn.how.to.draw&hl=en&gl=us&showAllReviews=true)). "ArtWorkout in its current state is *not* going to help you learn how to draw." ([Google Play](https://play.google.com/store/apps/details?id=app.artworkout.learn.how.to.draw&hl=en&gl=us&showAllReviews=true)).
9. "they'd draw inappropriate things after doing the art goal." ([Google Play](https://play.google.com/store/apps/details?id=app.artworkout.learn.how.to.draw&hl=en&gl=us&showAllReviews=true)).

Thin (fewer than 3 reviews, or one source), not to be called a trend: lost progress and login (8 reviews, one source; includes a 41-day streak lost while paying: "I had a 41 day streak, now it’s gone." [App Store, 3 stars](https://itunes.apple.com/es/reviews/id1851930904)); the red "you messed up" feedback (1 review).

## 2. What is missing (asked for in their words)

1. **Some real content that is free.** "I wish some were free to draw instead having to pay for them" ([App Store, 5 stars](https://itunes.apple.com/au/reviews/id871111183)). "Please don't make people pay for playing this game because people need to enjoy playing and might give up downloading Artworkout" ([App Store, 5 stars](https://itunes.apple.com/au/reviews/id43527697)). The tool's list of requests in the reviewers' own words has 25 more lines, mostly about free play and energy.
2. **A way to get one more go without paying or watching several ads.** "if the app at least had the option to unlock some of them by viewing ads I would give this app a higher rating." ([Google Play](https://play.google.com/store/apps/details?id=app.artworkout.learn.how.to.draw&hl=en&gl=us&showAllReviews=true)).
3. **Drawing with real people, and with friends.** "There's literally like 1 free 2 player drawing that you can do, and all the other cool ones are paid ones." ([Google Play](https://play.google.com/store/apps/details?id=app.artworkout.learn.how.to.draw&hl=en&gl=us&showAllReviews=true)). One reviewer who got it: "I FINALLY FOUND SOMEONE TO DRAW WITH IN MULTIPLAYER MODE" ([App Store, 5 stars](https://itunes.apple.com/au/reviews/id1831389643)).
4. **A way to reach the team.** "We have no way to contact them." ([App Store, 2 stars](https://itunes.apple.com/au/reviews/id1198485390)). Thin: 3 reviews say support answers with the same line and changes nothing.

## 3. What is unsolved (jobs the app ignores)

- **Children who cannot pay.** A few reviews are written by children: "I am 11 years old I do not control my account or anything with money" ([App Store, 5 stars](https://itunes.apple.com/us/reviews/id1380743009)). The app's business model asks them to buy things, How many reviewers are children was not counted, only seen. Any paid plan raises a consent and safety question too.
- **Drawing with someone you already know.** The app's draw-together is matching and pre-made pieces; a handful say outright they could not do it with friends. Evidence: theme 5.
- **Learning to draw, not tracing.** Two Google Play reviews say it teaches nothing about making your own drawing. Thin (3 reviews), but it is the reason a lesson app exists.

## Fix plan

Chosen by evidence times how cheap it is for this clone. Each is added to `features.csv` with `original` = no.

| # | fix | size | skill | evidence |
| --- | --- | --- | --- | --- |
| 1 | **Everything core stays free: every lesson, every room, every tool, no ads, no energy, no trial wall.** Already true in the clone. Make it a rule, not an accident: nothing that exists today may move behind a paywall | S (a decision) | replica-launch | themes 1, 2, 3: 339 + 238 + 182 reviews |
| 2 | **Rooms hold only real, invited people.** No bots, no replays standing in for a partner, no matching with strangers until reporting exists. Say so on the screen ("drawing with a real person") | S (true today) | replica-brand, replica-launch | theme 5: 65 reviews, about 20 naming bots |
| 3 | **A real way to charge, if any: one clear price, no trial that charges, cancel in one click, confirm in the account screen** | M | replica-launch, replica-backend | theme 4: 73 reviews at 2.2 stars. Any PRO the clone gets must be this |
| 4 | **Report a person and block them** (the `user_reports` table and RLS exist; there is no button) | M | replica-build | theme 9; a reviewer reports inappropriate drawings from strangers. Needed before Quick Play |
| 5 | **Lessons that teach one idea each** (a sentence of why before the trace, and "now draw it without the guide" as the last step of a lesson) | M | replica-build | theme 7 and the two Google Play reviews |
| 6 | **A visible contact and feedback link** in Settings | S | replica-build | "We have no way to contact them." and 3 reviews on support |
| 7 | **Never lose a streak because of the app** (when streaks exist: stored on the server, restorable) | M | replica-build, replica-backend | thin: 15 mentions of streaks, one source of loss; keep as a rule for when streaks are built |

Not taken: unlocking content by watching ads (it is asked for, but it is the source of theme 2, and the clone has no ads); a pen or Apple Pencil requirement (the clone works with a mouse, a finger or a pen, which already answers theme 6).

## The angle

Three options, each from a top theme. Wording of the original's name is left out on purpose.

**A. Real people.** For people who want to draw with a friend and not a bot, Penduet is a shared canvas you open with a code: no matching, no stand-ins, one canvas two people share.
Evidence: theme 5, 65 reviews across 2 sources, about 20 naming bots, AI or replays ("you are just playing with obvious bots." Google Play).

**B. Actually free.** For people who are tired of apps that say free and lock everything, Penduet lets you draw, learn and draw together with no energy, no ads and no trial wall.
Evidence: themes 1, 2 and 3: 339, 238 and 182 reviews across 2 sources. Half of all one and two star reviews mention paying.

**C. Safe for families.** For parents of kids who like drawing, Penduet has invite-only rooms and no chat with strangers.
Evidence: theme 9 only, 18 reviews, and the reviews written by children. Weak. Not recommended as the lead.

**Recommended: A as the hero, B as the promise under it.** "Draw with someone you know. Free, with no bots and no energy." A is what the app is already built around, B is the largest complaint, and the two do not conflict. One caution for `/replica-launch`: "free" has to be true for as long as it is said. The clone has no business model yet. Decide how it pays for servers before using the word in a headline. Do not use the original's name in the product name, ads or store listing, and do not put these reviewers' words on the landing page. Their words are research.
