# Cuh Golf

Dice-golf board game invented by the family, loosely based on CribbGolf. Built as a single-file, pass-and-play web game.

- Repo: github.com/kanetobey/cuh-golf (public), branch `main`
- Live: https://kanetobey.github.io/cuh-golf/ (GitHub Pages serves `main`, so every push updates the live game)
- Vanilla HTML/CSS/JS, inline SVG course, no build step, no dependencies beyond Google Fonts. `index.html` loads `css/` and `js/` with plain ordered `<script>` tags (not ES modules), so it also works opened straight from disk.

## Working rules

- `git pull` before starting. Commit and push when done so the live link updates.
- Test on a 390px-wide viewport before pushing.
- Mobile-first: 390px viewport, safe-area insets, 44px+ tap targets, no hover-only interactions. Keep it that way.
- Do not change rules, peg counts or balance without asking. If a rule or peg count does change, re-run a Monte Carlo sim of the real engine and show before and after numbers: `node tools/sim.js` (current engine) and `node tools/sim.js --ref <commit>` (an older single-file version), with `--out`/`--compare` to diff them.
- Rules below are final unless the owner says otherwise.

## Rules (current, final)

- Tee off: par 4 and 5 roll 2 dice, par 3 rolls 1. After the tee shot, roll 1 die.
- Move 1 peg per pip.
- Every hole has 4 tee routes, chosen fresh by each player on each hole:
  - Safe: longest, no hazards
  - Steady: 1 peg shorter, 1 pond
  - Aggressive: 2 pegs shorter, 2 ponds + a bunker
  - Hero: cuts the dogleg corner, 3 ponds
  - Hero sits on the inside of the dogleg, Safe on the outside, so the layout differs hole to hole. The tee picker shows live simulated odds (under par %, double+ %).
- Water: +1 stroke AND the ball goes back to where it was hit from.
- Bunker: the next roll counts 1 less.
- Overshooting the cup bounces back the remainder, but you always stop at least 1 peg ahead of where you shot from.
- Landing exactly on the cup = holed. Hole-in-one chaos is intentional. Keep it.
- On the green: roll 1 die. Even = in. Odd = +1 stroke, roll again.
- No max strokes per hole.
- Honors: lowest score on the previous hole tees off first (ties keep the previous order).
- Tie after 18: sudden-death playoff among only the tied players. Hole 19 plays hole 1, hole 20 plays hole 2, and so on until one player has the low score on a hole.

## Balance notes

Tuned by Monte Carlo sims of the real engine. Par 4 averages: Safe 4.38, Steady 4.35, Aggressive 4.28, Hero 4.60 (Hero has the most variance). Committing to one route all round, each route wins about 19 to 30% of rounds. The in-file comment above `HOLES` carries slightly older numbers from the same tuning.

## How the code is organised

`index.html` is the markup only (head, screens, overlays) plus the stylesheet and script tags. Scripts share one global scope and load in this order:

- `js/data.js`: `HOLES` (par, yards, handicap, dogleg bend) expanded into per-hole tiers. Each tier is `[branchPegs, joinIndex, hazards]`. Lane order L, LR, RL, R maps to tiers by dogleg sign (`laneTier`). `TIER_NAMES`, `COLORS`, `PAR_TOTAL`.
- `js/course.js`: a rounded-rectangle perimeter loop, holes spaced along it with a sinusoidal dogleg offset. Each route is a bowed branch of pegs joining the shared trunk (fairway + green). `buildCourse()` returns the static SVG string (flags are wrapped in `#flagN` groups so they can wobble; `#fx` is the empty effects layer).
- `js/engine.js`: rules and state, no DOM and no timers. `G` (players, hole, scores, lie, order, turn, phase, log). `resolveShot(lie, route, par, dice)` is the whole shot rule set as a pure function. `shoot()` rolls, applies the result to `G`, advances the turn, saves, and returns an outcome object: `dice, raw, mv, penalty, from, carry, hops, forward, back, path, bounce, stuck, landing, hazard, holed, strokesAdded, pos, state` plus `pi, before, strokes, diff, holeDone, msg`. `carry`/`hops` are a presentation-only split of the same path. `pickLane()`, `advanceAfterCard()`, `nextStep()`. `simHole` runs `resolveShot`, and `computeOdds()` fills `route.odds` (1500 plays per route) on load. `RIG` is a test hook for queued dice. Autosave key is `cuhgolf.round.v2`.
- `js/render.js`: camera (`fit`, `camView`, `ballCam`, `setCam`, `applyCamera`, `toScreen`; modes `hole`, `ball`, `course`; labels carry `data-x`/`data-y` so they can be counter-rotated), panel, balls, scorecard and overlays.
- `js/anim.js`: `Anim`, which owns all timing. `Anim.play(outcome)` runs the tee/roll/putt sequence and the moments (water, bunker, lip-out, ace, birdie, par, bogey). One rAF tween loop, transform/opacity only. `Anim.skip()` finishes everything instantly. Fast play (×0.4, `cuhgolf.fastplay` in localStorage), reduced-motion path, low-power confetti cut, sound cue hooks (`window.CUH_SOUND`).
- `js/ui.js`: event wiring and setup screen. Roll = `shoot()` then `Anim.play()` then redraw. Tap/Escape skips, a hidden tab skips, a 450ms guard stops a skipping tap from also rolling.
- `js/main.js`: boot plus `window.CUH` test hooks (`CUH.rig(6,6)`, `CUH.anim`, `CUH.G`).
- `css/game.css` (base rules, tokens, screens, overlays) and `css/anim.css` (effects layer, sized with container units from `.fxl`).

`G.hole` is zero-based and keeps counting past 17 in a playoff; `curH()` wraps with `% 18`. `G.active` is the list of player indexes still playing (shrinks to the tied players in a playoff). `G.lie[i].state` is one of `tee`, `fairway`, `bunker`, `green`, `holed`, `out`.

## Testing

- `node tools/sim.js` balance sim, `node tools/parity.js` full-game parity of the engine against the original single-file code (default ref `5e2f922`).
- Browser tests live in `test/` (Playwright, run with your installed Google Chrome via `channel: 'chrome'`). `cd test && npm install` once, serve the repo with `python3 -m http.server 8765`, then `node run.mjs` (8 viewports, rigged hole + ace, layout checks, contact sheets in `test/shots/`), `node extras.mjs` (skip, hidden tab, reload, reduced motion, fast play, rare paths) and `node timing.mjs [--fast]`.

## Design decisions

- Split into `index.html` + `css/` + `js/` (2026-10-30, `animations` branch). Plain scripts rather than ES modules so `file://` still works and there is no build step. Asset URLs carry `?v=N` so GitHub Pages' cache can't serve a new `index.html` with old scripts; bump it when shipping.
- Game logic never waits on an animation: `shoot()` has updated and saved `G` before `Anim.play()` starts, so skipping, backgrounding, a resize or reload mid-shot can't leave state wrong.
- Tee odds are simulated at load from the actual engine rather than hard-coded, so they stay honest if peg counts change.
- The round-start scorecard reuses the hole-complete overlay with the result list hidden.
- `window.claude?.hot` lines in BOOT are harmless hot-reload hooks left over from the artifact runtime the game was first built in.
- Every visible button is at least 44px tall, including the three camera-mode buttons (Hole, Ball, Course) and Fast play. Keep new controls at 44px or more.
- Short landscape phones (height ≤ 560px) use the side-by-side layout, with a scrolling panel.
- The game was first built inside the Claude artifact host, which injected the document wrapper, viewport meta and base styles. Those now live in the file itself (added 2026-10-28) so it works standalone on GitHub Pages.

## Backlog (parked, do not build until asked)

- "Chill at the clubhouse" rule: listed on the rules sheet, intentionally does nothing yet. Owner will define it later.
- Remove-player button in setup (and allow solo play).
- Sound effects: `Anim.cue(name)` calls already mark every spot (dice-tumble, dice-settle, launch, flight, touchdown, hop, roll, land, splash, ghost-return, bunker-thud, bunker-stuck, lip-out, cup, putt, ace, birdie, par, bogey, pencil-circle, skip).
- CPU opponents.
- Online / same-room multiplayer on separate phones (needs a backend for shared state).
