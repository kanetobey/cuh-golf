# Cuh Golf

A dice-golf board game our family invented, loosely based on CribbGolf, turned into a pass-and-play web game. One phone gets handed around the table, everyone rolls, the scorecard keeps itself.

**Play it now:** https://kanetobey.github.io/cuh-golf/

## What it is

- 2 to 4 players or teams (one name per team) on a single device.
- An 18-hole, par 72 course drawn in SVG, laid out in a loop around a clubhouse.
- Every hole has four tee routes to choose from: Safe, Steady, Aggressive or Hero. Shorter routes cut the dogleg but run through water.
- Rounds autosave to the browser, so you can quit to the title and pick up later.
- Three camera modes: Hole (rotated so you always play "up"), Ball, and Course.

## How to play

1. Tap **New Round**, enter names, pick a tee colour each, tap **Tee Off**.
2. On each hole the current player picks a tee route. The picker shows live simulated odds for each route (chance of under par, chance of double bogey or worse).
3. Tap **Drive**, **Roll** or **Putt**. The ball moves one peg per pip.
4. When everyone has holed out, the hole card and scorecard appear. Tap through to the next hole.
5. After 18 holes the lowest total wins. Ties go to a sudden-death playoff.

## Rules

- **Tee off:** par 4 and par 5 holes roll 2 dice. Par 3 holes roll 1 die. After the tee shot, every roll is 1 die.
- **Movement:** move 1 peg per pip.
- **Tee routes:** every hole has 4, chosen fresh by each player on each hole.
  - **Safe:** longest, no hazards.
  - **Steady:** 1 peg shorter, 1 pond.
  - **Aggressive:** 2 pegs shorter, 2 ponds and a bunker.
  - **Hero:** cuts the dogleg corner, 3 ponds.
  - Hero sits on the inside of the dogleg and Safe on the outside, so the layout differs hole to hole.
- **Water:** +1 stroke, and the ball goes back to where it was hit from.
- **Bunker:** the next roll counts 1 less.
- **Overshooting the cup:** bounce back the remainder, but you always stop at least 1 peg ahead of where you shot from.
- **Landing exactly on the cup:** holed. Yes, that means hole-in-ones happen. That is the point.
- **On the green:** roll 1 die. Even is in. Odd is +1 stroke, roll again.
- **No maximum strokes** per hole.
- **Honors:** lowest score on the previous hole tees off first.
- **Ties after 18:** sudden-death playoff among only the tied players. Hole 19 plays hole 1, hole 20 plays hole 2, and so on until one player has the low score on a hole.

## Running it locally

The whole game is one self-contained file, `index.html`. No build step, no dependencies beyond Google Fonts.

Open the file directly in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

It is designed mobile-first for a 390px-wide viewport. In desktop browsers, use device emulation (iPhone size) to see it as intended.

## Tech

Vanilla HTML, CSS and JavaScript. The course is procedurally laid out and drawn as inline SVG. Route odds on the tee picker come from a small Monte Carlo simulation of the real shot engine that runs on page load.
