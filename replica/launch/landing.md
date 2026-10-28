# Landing page: Penduet

Built in the app: `apps/web/src/pages/Home.tsx`, served at `/`. This file records the copy and the reasoning. The copy follows the voice in `brand.md`: friendly, plain, honest.

Screenshots are real: two people drawing in a room, captured from the running app by `scripts/capture-landing.mjs` (`apps/web/public/landing/`). They show a desktop and a phone layout and have text alternatives.

## Sections

1. **Hero.** Headline "Draw with someone you know." (the angle). Line: "Open a room, send the code, and draw on one canvas. The other person is always a real person: no bots, no ads, no energy meter." Primary button "Start a room", then "Try a lesson", then "Draw on your own". The picture is the real room.
2. **The problem.** "Drawing together should not need a payment plan." Two themes, paraphrased and with no numbers and no reviewer words: apps that lock almost everything behind a plan or an energy bar, and "draw with other people" that pairs you with a bot. The original is not named.
3. **How it works.** Three steps from the core flow: open a room; send the code; draw.
4. **What you get.** Five features, each tied to a fix in `fixes.md`: real people only (fix 2); nothing is locked (fix 1); lessons you can do together; works with what you have (mouse, finger, pen); your name, your data.
5. **Price.** "Price: nothing." Says there are no ads, energy or charging trial, and that anything added later will be optional, will show its price first and cancel in one click. See `pricing.md`: the last sentence is a commitment the owner must be willing to keep.
6. **Questions** (the real ones): is it free; do I need an account; how many people; what happens to my drawing; is it safe for children (answered plainly, including that there are no parental controls, age checks or report button yet); does it work on a tablet or a phone (answered with "supported, though it has not been tried on many devices").
7. **Final call.** "Open a room and send the code." and the button.

## What is deliberately not on the page

- **No proof section.** No user counts, ratings, press logos, awards or testimonials: none exist. A test (`L-E2`) fails the build if such words appear.
- **No reviewer quotes.** Their words are research.
- **The original's name** appears nowhere on the page or in the title (`L-E3`).
- **No price table**, because there is nothing to buy.

## Checks run

- Contrast and structure: axe scans of the page in light and dark pass (`X-2 home`). The page fits 390 px with no sideways scroll (`X-3 home`).
- Tests: `e2e/home.spec.ts` (5 cases). Full browser suite and unit tests: see the end of `launch-plan.md`.
- Seen by eye in a full-page screenshot at 1280 px.

## To do before this goes public

- A real logo and social image (brief in `brand.md`; five concepts in `replica/design/logo/`). The favicon is a stand-in.
- Done 2026-10-27: a footer with Privacy, Terms and "Send feedback" (see `legal-notes.md`); the "Design" link is gone from the navigation and the page is development-only; the Price section and the first FAQ answer now say "this first version has no ads" and that ads or a paid extra may come later, announced first. The hero line and the "Nothing is locked" card still say "no ads": they are true now, and must be edited the day ads come.
- Replace "Penduet" in the page if the name changes.
