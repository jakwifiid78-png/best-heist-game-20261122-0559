# Vaultbreak: The Midnight Lift — a heist game

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/jakwifiid78-png/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/jakwifiid78-png/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A top-down heist game for the make.fun bounty
"Make the best heist game" (best-heist-game-20261122-0559).

You are the thief on a midnight bank job. One floor, one vault holding
$5,000 in gold, three more stashes, three patrolling guards with vision
cones, and three wall cameras sweeping red sight beams. Lift every
stash, then reach the getaway van before the 3:00 clock runs out.

## Dossier

### Mechanics
- **Move:** WASD or arrow keys; click a spot to walk there. Hold **Shift**
  to sneak — slower, but guards and cameras spot you half as fast.
- **Loot:** the glowing vault gold ($5,000, top right), a gem ($800), a
  cash stack ($500), and gold bars ($1,200). Total $7,500. Taking the
  last stash unlocks the getaway van (bottom left) and plays a chime.
- **Score:** loot value in dollars, plus a time bonus (remaining seconds
  × $5) when you escape. Best score is kept in the browser.
- **Timer:** counts down from 3:00. At 0:00 the vault locks down and the
  run ends.
- **Lives:** 3. A guard that touches you while the alarm is up costs a
  life and sends you back to the start; 3 catches ends the run.

### Guard AI
- 3 guards patrol waypoint loops, pausing at each stop to scan.
  Their vision cones are drawn on the floor (yellow, red when alert).
- Being inside a cone fills the detection meter — faster up close,
  half as fast while sneaking, and not at all from a shadow patch
  unless the guard is very close.
- When the meter hits 100% the alarm trips: every guard chases your
  last-seen spot, then searches it for 3 seconds before resuming patrol.
- Break line of sight and the meter drains; if it falls to 45% while
  the alarm is up, the alarm clears and guards fall back to searching.

### Camera / alarm logic
- 3 cameras are fixed to walls/ceiling and sweep back and forth with
  visible red sight beams and a dashed sight line. A camera that has
  you in its beam fills the alarm meter at a flat rate (halved while
  sneaking); shadows hide you from cameras too, unless very close.
- The **ALARM meter** lives in the top HUD bar, labelled, with the
  state HIDDEN / SPOTTED / ALARM!. While the alarm is up the whole
  screen flashes red, a banner reads "ALARM — RUN!", and a two-tone
  siren sounds (WebAudio oscillator, no audio files).
- Desks, display cases, planters and walls block both movement and
  sight — use them as cover. Shadow patches (labelled on the floor)
  hide the thief.

### Win / lose
- **Win:** take all 4 loot items, then step into the getaway van.
- **Lose:** caught 3 times, or the 3:00 timer runs out.
- Title screen, win screen and game-over screen; **Enter** or click to
  start again, **R** to restart mid-run, **M** to mute.

### How to run it
```sh
node serve.ts        # serves game/ on http://localhost:8080
```
Or hand it in:
```sh
mkdir -p /tmp/heist-out && MAKEFUN_OUTPUT_DIR=/tmp/heist-out node main.ts
```
No build step, no network requests: `game/` is plain static files,
all art drawn in canvas code, all sound generated with WebAudio.

## Layout

- `main.ts` — hands the game in: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the kit's library.
- `game/index.html` + `game/src/` — the game itself, split by job:
  `config.js` (tuning, palette, the bank floor, guards, cameras, loot),
  `vision.js` (line of sight, cones, beams, collision), `world.js`
  (simulation: guards, cameras, alarm, loot, timer, win/lose),
  `render.js` (canvas drawing, HUD, alarm meter, screens), `input.js`,
  `audio.js` (generated sounds, no assets), `shots.js` (screenshot
  scenes), `main.js` (fixed-step loop), `random.js` (seeded RNG).
- `screenshots/` — 4 real renders of the game's own code: title,
  mid-heist, alarm tripped, clean getaway.
- `vendor/makefun-game.ts` — the kit's copy, unchanged.

## Screenshots

Taken with `node take-shots.mjs` against headless Chrome; each scene
plays the real rules forward from a fresh world with a one-step
lookahead autopilot that avoids cones and camera beams, so every frame
is what a short game really looks like. The play shot shows the thief
near loot with guard cones, camera beams and the alarm meter all
visible in one frame.
