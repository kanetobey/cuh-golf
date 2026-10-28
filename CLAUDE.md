# Cuh Golf

Dice-golf board game invented by the family, loosely based on CribbGolf. Built as a single-file, pass-and-play web game.

- Repo: github.com/kanetobey/cuh-golf (public), branch `main`
- Live: https://kanetobey.github.io/cuh-golf/ (GitHub Pages serves `main`, so every push updates the live game)
- Everything is in `index.html`: vanilla HTML/CSS/JS, inline SVG course, no build step, no dependencies beyond Google Fonts.

## Working rules

- `git pull` before starting. Commit and push when done so the live link updates.
- Test on a 390px-wide viewport before pushing.
- Mobile-first: 390px viewport, safe-area insets, 44px+ tap targets, no hover-only interactions. Keep it that way.
- Do not change rules, peg counts or balance without asking. If a rule or peg count does change, re-run a Monte Carlo sim of the real engine and show before and after numbers.
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

## How the code is organised (inside index.html)

Sections, in order, each marked with a `/* ---- NAME ---- */` comment in the script:

- **Head**: standalone document (doctype, charset, viewport meta with `viewport-fit=cover`). The favicon is an inline SVG data URI (white ball on felt green) so the game stays one file with no favicon.ico request.
- **CSS**: four base rules first (`[hidden]{display:none!important}`, safe-area padding on `:root`, body margin 0, img max-width), then design tokens on `:root` (felt green box lid, cream scorecard, gold pinstripe), then title/setup/play/overlay styles. The `[hidden]` rule matters: overlays set `display:flex`, which would otherwise beat the browser's default hidden styling and stack every overlay on the title screen.
- **HTML**: screens `#s-title`, `#s-setup`, `#s-play`; overlays `#o-hole` (also used for the round-start card), `#o-card`, `#o-rules`, `#o-menu`, `#o-final`.
- **DATA**: `HOLES` (par, yards, handicap, dogleg bend) expanded into per-hole tiers. Each tier is `[branchPegs, joinIndex, hazards]`. Lane order L, LR, RL, R maps to tiers by dogleg sign (`laneTier`). `TIER_NAMES`, `COLORS`, `PAR_TOTAL`.
- **COURSE GEOMETRY**: a rounded-rectangle perimeter loop, holes spaced along it with a sinusoidal dogleg offset. Each route is a bowed branch of pegs joining the shared trunk (fairway + green). `simHole` plus the loop that fills `route.odds` runs 1500 plays per route on load.
- **CAMERA**: `fit` and `applyCamera`; modes `hole`, `ball`, `course`. Labels carry `data-x`/`data-y` so they can be counter-rotated.
- **GAME STATE**: `G` (players, hole, scores, lie, order, turn, phase, active, log). `shoot()` is the whole shot engine. `nextStep()` decides next hole, playoff or final. Autosave key is `cuhgolf.round.v2`.
- **RENDER: PLAY**, **OVERLAYS**, **SETUP**, **BOOT**.

`G.hole` is zero-based and keeps counting past 17 in a playoff; `curH()` wraps with `% 18`. `G.active` is the list of player indexes still playing (shrinks to the tied players in a playoff). `G.lie[i].state` is one of `tee`, `fairway`, `bunker`, `green`, `holed`, `out`.

## Design decisions

- Single file on purpose for v1. A split is proposed but not done yet (see backlog).
- Tee odds are simulated at load from the actual engine rather than hard-coded, so they stay honest if peg counts change.
- The round-start scorecard reuses the hole-complete overlay with the result list hidden.
- `window.claude?.hot` lines in BOOT are harmless hot-reload hooks left over from the artifact runtime the game was first built in.
- Every visible button is at least 44px tall, including the three camera-mode buttons (Hole, Ball, Course). Keep new controls at 44px or more.
- The game was first built inside the Claude artifact host, which injected the document wrapper, viewport meta and base styles. Those now live in the file itself (added 2026-10-28) so it works standalone on GitHub Pages.

## Backlog (parked, do not build until asked)

- "Chill at the clubhouse" rule: listed on the rules sheet, intentionally does nothing yet. Owner will define it later.
- Remove-player button in setup (and allow solo play).
- Animation polish. Specs live on a Claude Design canvas called "Cuh Golf Shot Moments": a 3-second tee-shot storyboard (tumble, settle, launch, flight, hops, land and follow) and hazard/scoring moments (water splash with ghost ball back, bunker puff, lip-out bounce, hole-in-one confetti, birdie with circled score). Owner will share it when ready.
- CPU opponents.
- Online / same-room multiplayer on separate phones (needs a backend for shared state).
- Proposed file split: `index.html` + `css/` + `js/` modules (data, engine, render, ui). Awaiting owner's OK.
