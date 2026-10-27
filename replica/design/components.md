# Component specs: Penduet

Source list: `../recon.md` Components table. Tokens: `tokens.json`, `tokens.dark.json`, generated `tokens.css` and `tailwind.config.ts`.
Classes below are Tailwind role names: `bg-surface text-fg text-muted border-line border-input bg-accent text-on-accent` (see the map in `build_tokens.py`).

Everything here is original. Icons come from Lucide (ISC licence). Fonts are Inter and Manrope (SIL OFL). No asset, colour value or label is taken from the original app.

**Global rules**
- Touch targets are at least 44 x 44 px (`min-h-touch min-w-touch`), even when the visible shape is smaller.
- Focus: `focus-visible` shows a 2 px ring in `accent` with a 2 px offset. Never remove it.
- Colour is never the only signal: errors and states also have an icon and text.
- Motion uses `duration-fast` or `duration-base` with `ease-out`. `prefers-reduced-motion` sets both to 0 ms.
- Text on the canvas uses `ink`. The paper (`canvas`) stays light in dark mode.
- Priority: **MVP** is needed for M0 to M4 in `../architecture.md`. **Later** components are specified now so the vocabulary is stable, and built when their screen is.

---

## MVP components

### Button
```
variants  primary, secondary, ghost, danger
sizes     sm 36px, md 44px, lg 52px   (sm still has a 44px hit area)
states    default, hover, active, focus-visible, disabled, loading
tokens    primary: bg accent, text on-accent. secondary: bg surface, border line, text fg.
          ghost: transparent, text accent-text. danger: bg danger, text on-danger.
          radius md, font base/600, px space-4, gap space-2
loading   spinner replaces the icon, label stays, aria-busy="true", click ignored
a11y      real <button>, type="button" by default, disabled uses aria-disabled when it must stay focusable
used on   S01 S02 S05 S07 S09 S10 S12
```

### IconButton
```
variants  ghost, filled
sizes     44px square
states    default, hover, active, focus-visible, disabled, toggled (aria-pressed)
tokens    radius md, icon 20px stroke 2 (Lucide), toggled bg accent-soft + text accent-text
a11y      always has aria-label. Tooltip on hover and focus, never the only label
used on   S06 S11 S19 (undo, eraser, clear), S10 (copy code)
```

### Text input
```
sizes     md 44px
states    default, hover, focus, filled, error, disabled
tokens    bg bg, border border-input (3:1), text fg, placeholder muted, radius md,
          focus: 2px accent ring, error: border danger + icon + message in danger
a11y      <label> always visible, error linked with aria-describedby, aria-invalid on error
used on   S01 (display name), S15 (username search), S21
```

### Room code display
```
shape     6 characters in separate cells, font-mono code (28/32/700), letter-spacing 0.08em
parts     code, "Copy code" button, "Copy link" button, "Share" button where the Web Share API exists
states    default, copied (label changes to "Copied" for 2s with a check icon), room expired
tokens    cells bg surface, border line, radius md; text fg
a11y      the code is one text node read as "A B C 2 3 4" with aria-label, copy result announced with aria-live="polite"
used on   S10
```

### Room code input
```
shape     one field that shows 6 cells, auto-uppercase, accepts paste, ignores spaces and dashes, skips 0 O 1 I
states    empty, typing, complete (auto-submits after a short pause), checking, invalid code, room full, room not found
tokens    same as Text input; error text in danger with an icon
a11y      single <input inputmode="text" autocapitalize="characters" autocomplete="off">, cells are decorative
used on   S09
```

### Player chip
```
variants  me, peer
parts     colour dot (player-1 or player-2), display name, status
states    online, drawing (animated dot, static with reduced motion), reconnecting, left
tokens    pill radius, bg surface, border line, text sm/500, dot 10px
a11y      colour dot is paired with the name and a status text ("Mia, drawing"), never colour alone
used on   S10 S11 S12
```

### Drawing canvas
```
shape     fixed 1:1 logical space (1000 x 1000), letterboxed, max-w-canvas, bg canvas, shadow canvas, radius lg
layers    committed bitmap, live overlay (remote strokes in progress), guide overlay, cursor layer
states    idle, drawing, peer-drawing, replaying (late join), disconnected (dimmed + banner), read-only (lesson finished)
input     Pointer Events, touch-action none, pressure when available, coalesced events, palm rejection while a pen is active
a11y      role="img" with a text description that updates after each step ("Cat outline, step 2 of 5"); toolbar is the keyboard path;
          lesson steps can be completed with a "Skip step" button so a stroke is never the only way forward
used on   S06 S11 S19
```

### Guide overlay
```
variants  ghost line (dashed), step highlight, hit marker
states    visible, hit (segment turns accent), missed (segment pulses once in danger, then hint), hidden
tokens    guide colour (3:1 on canvas), stroke 3px dashed, highlight accent at 24% opacity
a11y      hints are also shown as text ("Too short", "Try a smoother curve") in an aria-live region
used on   S06 S11
```

### Drawing toolbar
```
parts     undo, eraser, colour swatch (opens colour picker), size control, clear
layout    bottom bar on phones, left rail from md up; items 44px, gap space-2
states    per item: default, hover, toggled, disabled; clear asks for confirmation
a11y      role="toolbar", arrow keys move between items, Esc closes popovers
used on   S06 S11 S19
```

### Colour picker
```
shape     8 to 12 fixed swatches + a "more" popover (hue + lightness)
states    default, selected (ring + check icon), disabled
tokens    swatch 36px with 44px hit area, ring 2px accent, every swatch has a text name for screen readers
a11y      radiogroup, each swatch has aria-label ("Red"), selected state announced
used on   S06 S11 S19
```

### Size control
```
shape     slider, 3 presets (S, M, L) + live preview dot
a11y      native <input type="range"> with aria-valuetext ("Medium, 8")
used on   S06 S11 S19
```

### Step progress
```
shape     segmented bar, one segment per lesson step, plus "Step 2 of 5" text
states    done (accent), current (accent-soft + ring), upcoming (surface)
a11y      role="progressbar" with aria-valuenow and aria-valuemax, the text is the real label
used on   S06 S11
```

### Score card
```
parts     accuracy 0-100, smoothness 0-100, stars (1 to 3), one hint line, Retry and Next buttons
states    revealing (numbers count up, 600ms, instant with reduced motion), final, failed step (shows hint and Retry as primary)
tokens    card: bg surface-raised, shadow card, radius lg; numbers font display; pass accent, fail danger plus icon
a11y      values in text, never only a graphic; focus moves to the card heading when it appears
used on   S07 S12
```

### Modal and sheet
```
variants  dialog (centered), bottom sheet (phones)
states    opening, open, closing; confirm, destructive (danger button)
tokens    bg surface-raised, shadow pop, radius xl, scrim ink at 40%
a11y      focus trap, focus returns to the trigger, Esc closes, aria-modal, labelled by its heading. Prefer Radix Dialog
used on   S06 (clear canvas), S10 (leave room), S18
```

### Toast
```
variants  info, success, error
behaviour bottom center, 4s (errors stay until dismissed), max 2 visible
a11y      role="status" (info/success) or role="alert" (error), never steals focus
used on   everywhere (copied, joined, left, save failed)
```

### Connection banner
```
variants  reconnecting, offline, peer left, room full, room expired
tokens    warning-soft bg + warning-text for transient, danger text for terminal, always with an icon and a plain sentence
behaviour sticky under the header, includes a retry or "Leave room" action
a11y      role="status", announces changes once
used on   S10 S11
```

### Segmented control
```
use       solo / with a friend, light / dark / system
states    default, selected, focus-visible, disabled
a11y      radiogroup with arrow-key navigation
used on   S09 S20
```

### Header and layout
```
header    56px, title left, actions right, safe-area padding on phones
content   max-w-content (1120px), page padding space-4 on phones and space-8 from md
tab bar   64px, bottom on phones, hidden on the canvas screens (S06 S11) to give the canvas room
breakpoints sm 640, md 768, lg 1024, xl 1280
```

---

## Later components (specified, built with their screen)

| component | variants | states | notes | used on |
| --- | --- | --- | --- | --- |
| Tab bar | 4 tabs (Home, Courses, Together, Profile) | selected, badge | hidden on canvas screens | S02-S16 |
| Course card | by level, locked | default, hover, locked, in progress | cover is original art, never a copy | S02 S03 |
| Lesson row | numbered | locked, current, done | progress ring for partial | S04 |
| Streak badge | flame icon + count | active, broken, restored | decorative icon plus text count | S02 S14 |
| Energy meter | bolt icon + count | full, low, empty, refilling | only if the energy system ships | S02 S05 |
| Friend row | with invite action | online, offline, pending | invite button is a real button | S15 |
| Achievement badge | locked, unlocked | | original badge art | S14 |
| Language selector | menu | open, selected | | S20 |
| Gallery tile | image + title | default, selected, loading | lazy images with alt text | S08 |
| Paywall plan card | weekly, monthly, yearly | default, selected, best value | prices from the store or Stripe, never hard-coded | S17 |
| Report dialog | reason list + details | submitting, sent | required before Quick Play | S11 |

## Screen checklist for every component
- Every state in the block exists in code, including focus, disabled, loading, error and empty.
- Keyboard: reachable with Tab, operable with Enter and Space, Esc closes overlays.
- Works at 320 px width and at 200% zoom without horizontal scroll.
- Works in light and dark, and with reduced motion.
