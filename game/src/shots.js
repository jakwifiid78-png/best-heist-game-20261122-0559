// Screenshot scenes behind ?shot=start|play|alarm|end. Each one plays the
// real rules forward from a fresh world, steered by a one-step lookahead
// autopilot (try 16 directions, keep out of guard cones and camera beams,
// chase the nearest loot, then the getaway van), so every frame is what a
// short game really looks like and the same seed always gives the same frame.

import { FIELD, STEP, GUARD, CAMERA, LEVEL } from './config.js';
import { inVisionCone, pointInRects, moveCircle } from './vision.js';
import { SCREEN_TITLE, SCREEN_PLAY, stepWorld } from './world.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const ALARM_WAIT_SECONDS = 1.2;
const DIRS = 16;

/** Danger of standing at (x,y): 1000 if any guard or camera sees you. */
function dangerAt(world, x, y) {
  const s = world.state;
  const solids = LEVEL.walls.concat(LEVEL.furniture);
  let danger = 0;
  for (const g of s.guards) {
    const res = inVisionCone(g.x, g.y, g.facing, GUARD.range, GUARD.coneHalf, x, y, solids);
    if (res.seen) {
      const hidden = pointInRects(x, y, LEVEL.shadows);
      if (!hidden || res.dist <= GUARD.shadowClose) danger += 1000;
    }
    const d = Math.hypot(g.x - x, g.y - y);
    if (d < 90) danger += (90 - d) * 0.5;
  }
  for (const cam of s.cameras) {
    const res = inVisionCone(cam.x, cam.y, cam.facing, CAMERA.range, CAMERA.halfAngle, x, y, solids);
    if (res.seen) {
      const hidden = pointInRects(x, y, LEVEL.shadows);
      if (!hidden || res.dist <= GUARD.shadowClose) danger += 900;
    }
  }
  return danger;
}

/** Greedy one-step autopilot: safest step that gets closer to the target. */
function autopilot(world) {
  const s = world.state;
  const solids = LEVEL.walls.concat(LEVEL.furniture);
  const p = s.player;
  let target = null;
  for (const l of s.loot) {
    if (!l.taken && (target === null || Math.hypot(l.x - p.x, l.y - p.y) < Math.hypot(target.x - p.x, target.y - p.y))) target = l;
  }
  if (target === null) target = { x: LEVEL.exit.x + LEVEL.exit.w / 2, y: LEVEL.exit.y + LEVEL.exit.h / 2 };
  let best = { mx: 0, my: 0, score: Infinity };
  for (let i = 0; i < DIRS; i += 1) {
    const a = (i / DIRS) * Math.PI * 2;
    const m = moveCircle(p.x, p.y, 14, Math.cos(a) * 12, Math.sin(a) * 12, solids);
    const danger = dangerAt(world, m.x, m.y);
    const dist = Math.hypot(target.x - m.x, target.y - m.y);
    const score = danger * 10 + dist;
    if (score < best.score) best = { mx: Math.cos(a), my: Math.sin(a), score };
  }
  const stayDanger = dangerAt(world, p.x, p.y);
  const stayDist = Math.hypot(target.x - p.x, target.y - p.y);
  if (stayDanger * 10 + stayDist <= best.score) return { mx: 0, my: 0, sneak: false };
  const sneak = stayDanger > 0 || best.score > 5000;
  return { mx: best.mx, my: best.my, sneak };
}

function runSteps(world, seconds, drive) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const input = drive ? drive(world) : { mx: 0, my: 0, sneak: false };
    stepWorld(world, STEP, input);
    if (world.screen !== SCREEN_PLAY) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'alarm' && name !== 'end') {
    runSteps(world, START_SECONDS, null);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    runSteps(world, PLAY_SECONDS, autopilot);
    return { screen: SCREEN_PLAY, best: world.state.lootTaken * 500 };
  }
  if (name === 'alarm') {
    // Put the thief in the open, ahead of the first guard, and let the real
    // detection meter fill until the alarm goes off — framed before the
    // guard closes in and catches them.
    const s = world.state;
    const g = s.guards[0];
    s.player.x = g.x + Math.cos(g.facing) * 120;
    s.player.y = g.y + Math.sin(g.facing) * 120;
    runSteps(world, ALARM_WAIT_SECONDS, null);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // end: every stash taken, the van open, the thief slipping in — the real
  // win path, driven into the van so the win screen is genuine.
  const s = world.state;
  for (const l of s.loot) l.taken = true;
  s.lootTaken = s.loot.length;
  s.lootValue = s.loot.reduce((a, l) => a + l.value, 0);
  world.score = s.lootValue;
  s.exitOpen = true;
  const e = LEVEL.exit;
  s.player.x = e.x + e.w / 2 + 170;
  s.player.y = e.y + e.h / 2;
  runSteps(world, 3, (w) => {
    const p = w.state.player;
    const dx = e.x + e.w / 2 - p.x;
    const dy = e.y + e.h / 2 - p.y;
    const d = Math.hypot(dx, dy);
    return d < 4 ? { mx: 0, my: 0, sneak: false } : { mx: dx / d, my: dy / d, sneak: false };
  });
  return { screen: world.screen, best: world.score };
}
