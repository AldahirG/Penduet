"""Builds the five logo concepts as SVG files plus a contact sheet (index.html).

Run from this folder: python make_logos.py

Each concept is two strokes in two colours, because the idea is two people on one canvas. The tile
versions sit on the brand cobalt (the in-app stand-in uses the same pair, white and warm yellow). The
paper versions use the two seat colours from the palette, as they appear on the drawing canvas.
Hand-drawn for this project; none of it is traced from anything.
"""
from pathlib import Path

COBALT = "#2b4fd8"
WHITE = "#ffffff"
YELLOW = "#fcd34d"
SEAT_A = "#c2410c"  # orange-red
SEAT_B = "#0b7285"  # teal
PAPER = "#fdfcf9"

STROKE = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'


def relay(a, b):
    # One line, started by one person and carried on by the other, with no seam.
    return (
        f'<path d="M12 44 C22 44 24 32 32 32" stroke="{a}" stroke-width="6.5" {STROKE}/>'
        f'<path d="M32 32 C40 32 42 20 52 20" stroke="{b}" stroke-width="6.5" {STROKE}/>'
    )


def two_ends(a, b):
    # A wave with a pen point at each end: two people, one line.
    return (
        f'<path d="M15 41 C22 21 30 21 32 32 S42 46 49 25" stroke="{a}" stroke-width="5" {STROKE}/>'
        f'<circle cx="15" cy="41" r="6" fill="{a}"/><circle cx="49" cy="25" r="6" fill="{b}"/>'
    )


def co_sun(a, b):
    # A sun: one draws the circle, the other the rays.
    rays = "".join(
        f'<path d="M{32 + 15 * dx:.1f} {32 + 15 * dy:.1f} L{32 + 23 * dx:.1f} {32 + 23 * dy:.1f}" stroke="{b}" stroke-width="5" {STROKE}/>'
        for dx, dy in [(0, -1), (0.707, -0.707), (1, 0), (0.707, 0.707), (0, 1), (-0.707, 0.707), (-1, 0), (-0.707, -0.707)]
    )
    return f'<circle cx="32" cy="32" r="9" stroke="{a}" stroke-width="6" fill="none"/>' + rays


def braid(a, b):
    # Two lines that start apart, cross in the middle and go on together.
    return (
        f'<path d="M9 40 C19 18 29 20 32 32 S45 46 55 24" stroke="{a}" stroke-width="6" {STROKE}/>'
        f'<path d="M9 24 C19 46 29 44 32 32 S45 18 55 40" stroke="{b}" stroke-width="6" {STROKE}/>'
    )


def monogram(a, b):
    # A "P" in two strokes: the stem by one person, the bowl by the other. Changes if the name does.
    return (
        f'<path d="M23 52 L23 13" stroke="{a}" stroke-width="7" {STROKE}/>'
        f'<path d="M23 13 H35 A11.5 11.5 0 0 1 35 36 H23" stroke="{b}" stroke-width="7" {STROKE}/>'
    )


CONCEPTS = [
    ("relay", "Relay", "One line, two hands. Started by one, carried on by the other, no seam. The simplest of the five; strongest at 16 px.", relay),
    ("two-ends", "Two ends", "A wave with a pen point at each end. Reads as two people on one line. The dots are the most readable thing at tiny sizes.", two_ends),
    ("co-sun", "Co-sun", "The first lesson-style picture: one draws the circle, the other the rays. Friendliest, and it matches the screenshot on the home page. Sun icons are common, so the two colours do the work.", co_sun),
    ("braid", "Braid", "Two lines that start apart, cross in the middle and go on. Looks most like a mark. Check it does not read as a DNA or recycling symbol next to a tile.", braid),
    ("monogram", "P in two strokes", "The initial, drawn by two people. Ties the symbol to the name, so it has to be redrawn if the name changes.", monogram),
]


def tile(fn):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">'
        f'<rect width="64" height="64" rx="14" fill="{COBALT}"/>' + fn(WHITE, YELLOW) + "</svg>"
    )


def paper(fn):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">'
        f'<rect width="64" height="64" rx="14" fill="{PAPER}" stroke="#d6dbe6"/>' + fn(SEAT_A, SEAT_B) + "</svg>"
    )


def main():
    here = Path(__file__).parent
    cards = []
    for slug, name, note, fn in CONCEPTS:
        (here / f"{slug}.svg").write_text(tile(fn), encoding="utf-8")
        (here / f"{slug}-paper.svg").write_text(paper(fn), encoding="utf-8")
        cards.append(
            f"""<article>
  <h2>{name}</h2>
  <div class="row">{tile(fn).replace('width=\"64\" height=\"64\"', 'width=\"128\" height=\"128\"', 1)}{paper(fn).replace('width=\"64\" height=\"64\"', 'width=\"128\" height=\"128\"', 1)}</div>
  <div class="row small">{tile(fn).replace('width=\"64\" height=\"64\"', 'width=\"32\" height=\"32\"', 1)}{tile(fn).replace('width=\"64\" height=\"64\"', 'width=\"16\" height=\"16\"', 1)}
    <span class="lockup">{tile(fn).replace('width=\"64\" height=\"64\"', 'width=\"28\" height=\"28\"', 1)}<b>Penduet</b></span></div>
  <p>{note}</p>
</article>"""
        )
    html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Logo concepts</title>
<style>
body{{margin:0;padding:24px;font:16px/1.5 system-ui,sans-serif;background:#f6f7fb;color:#1c2333}}
h1{{font-size:22px;margin:0 0 4px}} .lead{{color:#4b5568;margin:0 0 20px;max-width:60ch}}
.grid{{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}}
article{{background:#fff;border:1px solid #d6dbe6;border-radius:12px;padding:16px}}
h2{{font-size:17px;margin:0 0 10px}} .row{{display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap}}
.small{{gap:16px}} .lockup{{display:inline-flex;align-items:center;gap:8px;font-size:20px}} p{{margin:0;color:#4b5568;font-size:14px}}
</style></head><body>
<h1>Logo concepts</h1>
<p class="lead">Five ideas for the symbol, each two strokes in two colours. Left: on the brand blue. Right: on paper in the two seat colours. Below: 32 px, 16 px and next to the name. Drawn for this project, not traced from anything.</p>
<div class="grid">{''.join(cards)}</div></body></html>"""
    (here / "index.html").write_text(html, encoding="utf-8")
    print("wrote", len(CONCEPTS) * 2, "svg files and index.html")


main()
