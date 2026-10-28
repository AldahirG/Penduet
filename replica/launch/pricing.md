# Pricing: Penduet

Written 2026-10-27. **Nothing here is live and nothing is built.** The product has no billing code, no Stripe account and no paid feature. Today everything is free, and the landing page says so. This file is the plan for what to do if you decide to charge, and the rules to keep either way.

## What the original and two alternatives charge

Read on 2026-10-27 from the public store pages. The App Store pages were summarised by a fetch tool, not copied by hand, so treat the figures as medium confidence and check the page before quoting a number anywhere.

| product | what it is | price | source |
| --- | --- | --- | --- |
| ArtWorkout (the original) | drawing lessons, plus draw-together | Free to download, with subscriptions. The App Store US page lists, in this order: weekly $6.99; annual $41.99; yearly $59.99; yearly $69.99; annual $49.99; weekly $6.99; yearly $29.99; monthly $7.99; 3 months $29.99; weekly $4.99. The page does not say why a name appears at several prices. No trial terms are stated on the page. 4.6 stars, 254K ratings | https://apps.apple.com/us/app/artworkout-learn-how-to-draw/id1564657118 |
| ArtWorkout, Google Play | the same, on Android | "Contains ads", "In-app purchases". No prices on the listing page. 4.5 stars shown | https://play.google.com/store/apps/details?id=app.artworkout.learn.how.to.draw |
| PairDrawing | real-time drawing for two people on one canvas | Free. One in-app purchase listed: "Remove ads", 5,99 €. No subscription. 4.0 stars, 1 rating | https://apps.apple.com/it/app/pairdrawing/id6755837968 |

Not read, so not in the table: Gartic Phone (the page failed a certificate check) and Drawabox (the page showed only a loading message). Another pass with a human in the browser is worth doing before launch.

## What users said about price and billing

From `feedback.md` (920 recent reviews of the original, 2 sources; keyword matches, not hand-coded, so counts are approximate):

- **339 reviews (37%)** are about paying for access: the free version cannot really be used. Among the 333 one and two star reviews, **171 (51%)** mention it.
- **238 reviews (26%)** mention ads, many of them ads to earn energy.
- **182 reviews (20%)** mention energy that runs out.
- **73 reviews (8%)** are about billing: trials that charge, cancelling that does not stop the charge. Average rating **2.2 stars, the lowest of any theme.**

What reviewers asked for in their own words is in `fixes.md` (some content that is free; one more go without paying; a way to reach the team).

## The model

**Free for everything that exists today. If a paid plan is ever added, it is optional, and it covers only what costs real money to run.**

Why this model: the angle in `fixes.md` ("no bots, no ads, no energy meter") only works if the free product is complete. A free tier that is a demo is exactly what the original's reviewers hate. What does cost money as the product grows is storage (a gallery of saved drawings, kept on a server) and capacity (larger groups). Those are honest things to charge for. Lessons and rooms are not.

### Tiers (two, named by who they are for)

| tier | for | what is in it | price (proposal, not decided) |
| --- | --- | --- | --- |
| **Free** | anyone who wants to draw with a friend | every lesson, every room, every tool, saving an image, no ads, no energy, no trial | $0 |
| **Plus** (does not exist yet) | people who want to keep what they draw | a gallery with drawings stored on a server, drawing in rooms of more than two (when built), extra lesson packs (when written) | $3 a month, or $30 a year (two months free). No weekly plan |

Why these numbers: the original's cheapest yearly price on the page is $29.99 and its monthly is $7.99. $30 a year matches its low end for something that costs less to run, and a plain monthly price is under half of theirs. These are proposals to test, not research results: no one has been asked what they would pay.

### Rules that fix the billing complaints (apply to any paid plan)

1. **No trial that charges by default.** If there is a trial, it asks for no payment details until you choose to continue.
2. **Cancel in one click, in Settings.** Not an email, not a form, not a store maze.
3. **The price is on the button** and again on the screen before you confirm. The renewal date is shown after.
4. **A renewal email 7 days before any yearly charge**, and a receipt after every charge.
5. **No weekly plans**, and no plan that appears at several prices.
6. **A refund policy in one plain paragraph** on the pricing page.
7. **Children:** no payment screen for someone who is not an adult. This is a legal question (consent for children's purchases differs by country); ask a lawyer before building it.
8. **The free list in the landing page and in the store listing is a promise.** Nothing on that list moves behind a plan. A test already guards the landing copy against fake proof; add one that guards this list when a plan exists.

## Stripe (web) and the stores

Do not build this until a decision is made. When it is:

- **You create the Stripe account and products** (the code never does, and starts in test mode):
  - Product "Penduet Plus"
  - Price 1: 3.00 USD, recurring monthly
  - Price 2: 30.00 USD, recurring yearly
  - Customer Portal switched on, with "cancel subscription" enabled (this is the one-click cancel)
  - Webhooks, with signature checks and idempotency (`webhook_events` already exists): `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. See `backend.md`.
- **In the iOS and Android apps, digital purchases normally have to use the stores' own billing**, with a different price and a fee. A web plan and an app plan are two systems. The product is a web app for now, so this does not apply yet.

## Decision, 2026-10-27

**The first version is free, with no ads.** Ads may be added later, announced first on the site and in the privacy policy; this was the owner's call. That replaces the earlier plan to keep "the free parts stay free" as a promise: ads change the free experience, so the landing page, the terms and the policy now say "this first version has no ads" instead of "never". The Plus tier below is still a possible later option, not a plan.

Things to hold on to if ads come: the original's reviewers hate ads that gate access (238 of 920 reviews mention ads, many of them ads to earn energy). An ad that blocks drawing, or that has to be watched to continue, breaks the angle in `fixes.md`. If ads come, keep them out of the room and out of lessons, and decide it before choosing a network. The checklist for the day is in `legal-notes.md`.

## Decisions for you

1. ~~Charge at all?~~ Decided for now: free first version. Still open: how to pay for servers later: ads (decided as possible), a donation link, a sponsor, a school licence, or Plus.
2. If Plus: is a gallery, bigger groups and lesson packs the right content, and is $3 / $30 the right test?
3. Who counts as an adult when someone pays?
