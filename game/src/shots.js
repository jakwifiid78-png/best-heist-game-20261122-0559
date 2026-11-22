// Vaultbreak — screenshot scenes. Each shot plays the real rules forward
// from a fresh world with a small autopilot at the wheel, so every frame
// is what a short game really looks like — no posed tableaus, no cheats.
// The autopilot reads the same sight rules the guards use (cones, beams,
// shadows, furniture) and steers around them with a one-step lookahead.
//
// Shots (see shots.json): start = title, play = ~26s mid-heist with loot
// in hand, alarm = spotted until the alarm trips, end = a full win.
//
// stageShot(name, world) runs the simulation synchronously and leaves the
// world exactly where the screenshot should catch it. main.js then paints
// that frozen world and raises window.__shotReady.

import { stepWorld } from './world.js';
import { TUNE } from './config.js';
import { dist, inWedge, losClear, insideSolids, inShadow } from './vision.js';

const STEP = 1 / 60;
const IDLE = { mx: 0, my: 0, sneak: false, goto: null };

// Is the point (x, y) inside any guard cone or camera beam right now?
// Mirrors the simulation's sight rules: wedge + clear line of sight,
// and shadows hide you unless the watcher is very close.
function threatAt(world, x, y) {
  const floor = world.floor;
  for (const g of world.guards) {
    if (dist(g.x, g.y, x, y) > TUNE.coneRange) continue;
    if (!inWedge(x, y, g.x, g.y, g.heading, TUNE.coneRange, TUNE.coneHalf)) continue;
    if (!losClear(g.x, g.y, x, y, world.solids)) continue;
    if (inShadow(x, y, floor.shadows) && dist(g.x, g.y, x, y) > TUNE.shadowNear) continue;
    return { danger: true, ox: g.x, oy: g.y };
  }
  for (const c of world.cameras) {
    if (dist(c.x, c.y, x, y) > c.range) continue;
    if (!inWedge(x, y, c.x, c.y, c.heading, c.range, c.half)) continue;
    if (!losClear(c.x, c.y, x, y, world.solids)) continue;
    if (inShadow(x, y, floor.shadows) && dist(c.x, c.y, x, y) > TUNE.shadowNear) continue;
    return { danger: true, ox: c.x, oy: c.y };
  }
  return { danger: false, ox: 0, oy: 0 };
}

// Steer toward (tx, ty) while staying out of sight. If the thief is
// already seen, run directly away from the watcher. Otherwise probe a
// step ahead: if the straight line walks into a cone or a beam, try
// angled detours (sneaking while detouring); only push through a watched
// gap when no detour is clear.
function drive(world, tx, ty) {
  const t = world.thief;
  const seen = threatAt(world, t.x, t.y);
  if (seen.danger) {
    let dx = t.x - seen.ox;
    let dy = t.y - seen.oy;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    return { mx: dx, my: dy, sneak: false, goto: null };
  }
  const dx = tx - t.x;
  const dy = ty - t.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) return IDLE;
  const base = Math.atan2(dy, dx);
  const detours = [0, 0.85, -0.85, 1.7, -1.7, 2.5, -2.5];
  for (const off of detours) {
    const a = base + off;
    const px = t.x + Math.cos(a) * 54;
    const py = t.y + Math.sin(a) * 54;
    if (insideSolids(px, py, world.solids, 16)) continue;
    if (threatAt(world, px, py).danger) continue;
    return { mx: Math.cos(a), my: Math.sin(a), sneak: off !== 0, goto: null };
  }
  // No clean step: sneak straight at the target and hope the gap opens.
  return { mx: Math.cos(base), my: Math.sin(base), sneak: true, goto: null };
}

// The greedy heist driver: nearest remaining stash, then the van.
function heistDriver(world) {
  let target = null;
  let bestD = Infinity;
  for (const item of world.loot) {
    if (item.taken) continue;
    const d = dist(world.thief.x, world.thief.y, item.x, item.y);
    if (d < bestD) {
      bestD = d;
      target = item;
    }
  }
  if (target) return drive(world, target.x, target.y);
  if (world.vanOpen) {
    const v = world.floor.van;
    return drive(world, v.x + v.w / 2, v.y + v.h / 2);
  }
  return IDLE;
}

// The "please notice me" driver: walk to a spot right in front of the
// first guard's nose and stand there until the meter fills. No dodging,
// no sneaking — getting spotted is the whole point of this shot.
function spotMeDriver(world) {
  const g = world.guards[0];
  const sx = g.x + Math.cos(g.heading) * 70;
  const sy = g.y + Math.sin(g.heading) * 70;
  const t = world.thief;
  const d = dist(t.x, t.y, sx, sy);
  if (d < 14) return IDLE;
  return { mx: (sx - t.x) / d, my: (sy - t.y) / d, sneak: false, goto: null };
}

// Step the world for up to `seconds`, asking `driver` for the control
// each tick. Stops early when `done(world)` is true.
function runFor(world, seconds, driver, done) {
  const ticks = Math.round(seconds / STEP);
  for (let i = 0; i < ticks; i += 1) {
    const ctrl = driver ? driver(world) : IDLE;
    stepWorld(world, ctrl, STEP);
    if (done && done(world)) return true;
  }
  return !!(done && done(world));
}

export function stageShot(name, world) {
  if (name === 'start') {
    // Title screen with the hall alive behind it: three seconds of
    // patrol and sweeping cameras, then freeze on the title.
    world.phase = 'title';
    runFor(world, 3, null, null);
    return;
  }

  if (name === 'play') {
    // Mid-heist: stop the moment the second stash is lifted, so the
    // frame catches the thief deep in the hall with cones, beams and the
    // meter all in view — never a finished run. (The autopilot is fast
    // enough to win the whole job inside 26 seconds, so a plain time
    // cap would land on the win screen instead.)
    world.phase = 'playing';
    runFor(world, 26, heistDriver, (w) => w.lootGot >= 2);
    return;
  }

  if (name === 'alarm') {
    // Walk into the light until the alarm trips, then freeze on the red
    // banner frame. If the first guard will not cooperate, the camera
    // beams are a second way to fill the meter.
    world.phase = 'playing';
    runFor(world, 25, spotMeDriver, (w) => w.alarm);
    return;
  }

  if (name === 'end') {
    // The full job: lift every stash, then escape in the van. The clock
    // gives 180 seconds; the autopilot gets 175 of them.
    world.phase = 'playing';
    runFor(world, 175, heistDriver, (w) => w.phase === 'won');
    return;
  }

  // Unknown shot name: leave a plain title frame rather than crashing.
  world.phase = 'title';
  runFor(world, 1, null, null);
}
