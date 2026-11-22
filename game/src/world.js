// Vaultbreak — the simulation: one fresh world per run, stepped forward
// in fixed slices by main.js (or by the screenshot autopilot).
//
// A control is a plain object the step function reads every tick:
//   { mx, my }   wish direction, each in [-1, 1] (keyboard or autopilot)
//   { sneak }    true while Shift is held (slower, spotted half as fast)
//   { goto }     click-to-move target {x, y}, or null
// The step returns nothing; it appends plain event objects to
// world.events (pickup, alarm, caught, unlock, win, timeout, ...) and
// main.js turns those into sounds and announcements.

// eslint-disable-next-line no-unused-vars
import { buildFloor, solidRects, TUNE, VIEW_W, VIEW_H, FLOOR_LEFT, FLOOR_RIGHT, FLOOR_TOP, FLOOR_BOTTOM } from './config.js';
import { makeRng, randRange } from './random.js';
import { clampN, dist, angleDiff, inWedge, losClear, slideCircle, inShadow, sightWeight } from './vision.js';

// One brand-new night. `seed` only varies the cosmetic sparkle phases
// and the guards' starting scan offsets, so replays stay fair.
export function freshWorld(seed) {
  const rng = makeRng(seed || 1);
  const floor = buildFloor();
  const solids = solidRects(floor);

  const guards = floor.guardRoutes.map((route, i) => {
    const start = route.path[0];
    return {
      id: i,
      x: start.x,
      y: start.y,
      heading: 0,
      leg: 1, // index of the waypoint currently being walked to
      pausing: 0, // seconds left standing and scanning at a waypoint
      scanPhase: randRange(rng, 0, Math.PI * 2),
      mode: 'patrol', // patrol | chase | search
      lastSeen: { x: start.x, y: start.y },
      searchT: 0,
      speed: TUNE.guardWalk,
    };
  });

  const cameras = floor.cameras.map((c, i) => ({
    id: i,
    x: c.x,
    y: c.y,
    base: c.base,
    sweep: c.sweep,
    range: c.range,
    half: TUNE.camHalf,
    heading: c.base,
    phase: randRange(rng, 0, Math.PI * 2),
  }));

  const loot = floor.lootSpots.map((spot, i) => ({
    id: spot.id,
    label: spot.label,
    value: spot.value,
    x: spot.x,
    y: spot.y,
    color: spot.color,
    taken: false,
    sparkle: randRange(rng, 0, Math.PI * 2),
    index: i,
  }));

  let best = 0;
  try {
    best = Number(window.localStorage.getItem('vaultbreak-best') || 0) || 0;
  } catch (err) {
    best = 0; // private mode or no storage: best score just stays 0
  }

  return {
    seed: seed || 1,
    rng,
    floor,
    solids,
    phase: 'title', // title | playing | won | over
    clock: 0, // seconds of wall-clock inside this run (drives animation)
    timeLeft: TUNE.timeLimit,
    score: 0,
    best,
    lootGot: 0,
    lives: TUNE.lives,
    meter: 0, // alarm meter 0..1
    alarm: false,
    alarmT: 0,
    flash: 0, // red flash timer after the alarm trips
    thief: {
      x: floor.spawn.x,
      y: floor.spawn.y,
      r: TUNE.thiefRadius,
      heading: -Math.PI / 2,
      moving: false,
      sneaking: false,
      invuln: 0,
      goto: null,
    },
    guards,
    cameras,
    loot,
    vanOpen: false,
    events: [],
    overReason: '',
  };
}

// --- small helpers -------------------------------------------------------

function nearestWaypoint(guard, route) {
  return route.path[guard.leg % route.path.length];
}

function guardTarget(guard) {
  return guard.mode === 'chase' || guard.mode === 'search'
    ? guard.lastSeen
    : null;
}

// --- the step ------------------------------------------------------------

export function stepWorld(world, ctrl, dt) {
  world.clock += dt;
  world.events.length = 0;

  // Title / end screens: the hall stays alive behind the overlay —
  // guards patrol, cameras sweep — but nothing else advances.
  if (world.phase !== 'playing') {
    for (const g of world.guards) patrolGuard(world, g, dt);
    for (const c of world.cameras) sweepCamera(c, dt);
    return;
  }

  const t = world.thief;
  const floor = world.floor;

  // Countdown. At zero the vault locks down and the run ends.
  world.timeLeft -= dt;
  if (world.timeLeft <= 0) {
    world.timeLeft = 0;
    endRun(world, 'over', 'TIME UP — the vault locked down.');
    world.events.push({ type: 'timeout' });
    return;
  }
  if (t.invuln > 0) t.invuln -= dt;
  if (world.flash > 0) world.flash -= dt;

  // --- thief movement ----------------------------------------------------
  let mx = ctrl.mx || 0;
  let my = ctrl.my || 0;
  const mag = Math.hypot(mx, my);
  if (mag > 1) {
    mx /= mag;
    my /= mag;
  }
  if (mag < 0.05 && ctrl.goto) {
    // Click-to-move: steer at the tapped spot until close, then stop.
    const dx = ctrl.goto.x - t.x;
    const dy = ctrl.goto.y - t.y;
    const d = Math.hypot(dx, dy);
    if (d > 8) {
      mx = dx / d;
      my = dy / d;
    } else {
      t.goto = null;
    }
  } else if (mag >= 0.05) {
    t.goto = null; // keys take over from a click destination
  }

  t.sneaking = !!ctrl.sneak;
  const speed = t.sneaking ? TUNE.thiefSneak : TUNE.thiefWalk;
  const step = speed * dt;
  const moved = slideCircle(
    t.x,
    t.y,
    t.r,
    mx * step,
    my * step,
    world.solids,
  );
  // Keep the thief inside the hall even if a push-out disagrees.
  t.x = clampN(moved.x, FLOOR_LEFT + t.r, FLOOR_RIGHT - t.r);
  t.y = clampN(moved.y, FLOOR_TOP + t.r, FLOOR_BOTTOM - t.r);
  t.moving = mag >= 0.05 || (ctrl.goto && Math.hypot(ctrl.goto.x - t.x, ctrl.goto.y - t.y) > 8);
  if (t.moving) t.heading = Math.atan2(my, mx) || t.heading;

  // --- cameras sweep ------------------------------------------------------
  for (const c of world.cameras) sweepCamera(c, dt);

  // --- guards -------------------------------------------------------------
  for (const g of world.guards) {
    if (g.mode === 'patrol') patrolGuard(world, g, dt);
    else if (g.mode === 'chase') chaseGuard(world, g, dt);
    else searchGuard(world, g, dt);
  }

  // --- detection: cones and beams fill the meter, hiding drains it -------
  let fill = 0;
  let seenBy = null;
  for (const g of world.guards) {
    const w = sightWeight(
      { x: g.x, y: g.y, heading: g.heading, range: TUNE.coneRange, half: TUNE.coneHalf },
      t.x,
      t.y,
      floor,
      world.solids,
      TUNE.shadowNear,
    );
    if (w > 0) {
      const d = dist(g.x, g.y, t.x, t.y);
      const near = d < 80 ? TUNE.guardClose : d < 140 ? TUNE.guardMid : TUNE.guardFar;
      const rate = TUNE.guardFill * near * (t.sneaking ? TUNE.sneakFactor : 1) * (0.55 + w * 0.45);
      if (rate > fill) {
        fill = rate;
        seenBy = g;
      }
      // A guard that can see you remembers where you are.
      g.lastSeen.x = t.x;
      g.lastSeen.y = t.y;
    }
  }
  for (const c of world.cameras) {
    const w = sightWeight(
      { x: c.x, y: c.y, heading: c.heading, range: c.range, half: c.half },
      t.x,
      t.y,
      floor,
      world.solids,
      TUNE.shadowNear,
    );
    if (w > 0) {
      const rate = TUNE.camFill * (t.sneaking ? TUNE.sneakFactor : 1);
      if (rate > fill) {
        fill = rate;
        seenBy = c;
      }
    }
  }

  if (fill > 0) {
    world.meter = clampN(world.meter + fill * dt, 0, 1);
  } else {
    world.meter = clampN(world.meter - TUNE.meterDrain * dt, 0, 1);
  }

  // The alarm trips at a full meter. Guards switch to the chase, the
  // screen flashes red, and the siren starts (main.js hears the event).
  if (!world.alarm && world.meter >= 1) {
    world.alarm = true;
    world.alarmT = 0;
    world.flash = 0.9;
    for (const g of world.guards) {
      g.mode = 'chase';
      g.searchT = 0;
    }
    world.events.push({ type: 'alarm' });
  }
  if (world.alarm) {
    world.alarmT += dt;
    if (world.meter <= TUNE.alarmClearAt) {
      // Slipped away clean: the alarm stands down, guards go searching.
      world.alarm = false;
      for (const g of world.guards) {
        if (g.mode === 'chase') {
          g.mode = 'search';
          g.searchT = TUNE.searchTime;
        }
      }
      world.events.push({ type: 'alarmClear' });
    }
  }

  // --- loot ---------------------------------------------------------------
  for (const item of world.loot) {
    if (item.taken) continue;
    if (dist(t.x, t.y, item.x, item.y) < TUNE.pickupDist) {
      item.taken = true;
      world.lootGot += 1;
      world.score += item.value;
      world.events.push({ type: 'pickup', id: item.id, value: item.value });
      if (world.lootGot >= world.loot.length) {
        world.vanOpen = true;
        world.events.push({ type: 'unlock' });
      }
    }
  }

  // --- the getaway van ------------------------------------------------------
  if (world.vanOpen) {
    const v = floor.van;
    if (t.x > v.x && t.x < v.x + v.w && t.y > v.y && t.y < v.y + v.h) {
      const bonus = Math.round(world.timeLeft) * TUNE.winBonusPerSec;
      world.score += bonus;
      endRun(world, 'won', '');
      world.events.push({ type: 'win', bonus });
      return;
    }
  }

  // --- caught ---------------------------------------------------------------
  if (world.alarm && t.invuln <= 0) {
    for (const g of world.guards) {
      if (dist(t.x, t.y, g.x, g.y) < TUNE.catchDist) {
        world.lives -= 1;
        world.events.push({ type: 'caught', lives: world.lives });
        if (world.lives <= 0) {
          endRun(world, 'over', 'CAUGHT three times — the crew got pinched.');
          return;
        }
        // Back to the start door, meter partly drained, brief grace.
        t.x = floor.spawn.x;
        t.y = floor.spawn.y;
        t.goto = null;
        t.invuln = TUNE.respawnInvuln;
        world.meter = 0.35;
        world.alarm = false;
        for (const gg of world.guards) {
          gg.mode = 'search';
          gg.searchT = TUNE.searchTime;
          gg.lastSeen.x = floor.spawn.x;
          gg.lastSeen.y = floor.spawn.y;
        }
        break;
      }
    }
  }
}

// --- guard behaviours ------------------------------------------------------

function patrolGuard(world, g, dt) {
  const route = world.floor.guardRoutes[g.id];
  if (g.pausing > 0) {
    // Stand and scan: slow sweep of the facing around the arrival heading.
    g.pausing -= dt;
    g.scanPhase += dt * 1.6;
    g.heading += Math.sin(g.scanPhase) * 0.9 * dt;
    return;
  }
  const wp = nearestWaypoint(g, route);
  const dx = wp.x - g.x;
  const dy = wp.y - g.y;
  const d = Math.hypot(dx, dy);
  const step = TUNE.guardWalk * dt;
  if (d <= Math.max(step, 3)) {
    g.x = wp.x;
    g.y = wp.y;
    g.leg = (g.leg + 1) % route.path.length;
    g.pausing = TUNE.guardPause;
    return;
  }
  g.x += (dx / d) * step;
  g.y += (dy / d) * step;
  g.heading = Math.atan2(dy, dx);
}

function chaseGuard(world, g, dt) {
  const target = g.lastSeen;
  const dx = target.x - g.x;
  const dy = target.y - g.y;
  const d = Math.hypot(dx, dy);
  const step = TUNE.guardChase * dt;
  if (d <= Math.max(step, 6)) {
    g.x = target.x;
    g.y = target.y;
    g.mode = 'search';
    g.searchT = TUNE.searchTime;
    return;
  }
  const moved = slideCircle(g.x, g.y, TUNE.guardRadius, (dx / d) * step, (dy / d) * step, world.solids);
  g.x = clampN(moved.x, FLOOR_LEFT + 14, FLOOR_RIGHT - 14);
  g.y = clampN(moved.y, FLOOR_TOP + 14, FLOOR_BOTTOM - 14);
  g.heading = Math.atan2(dy, dx);
}

function searchGuard(world, g, dt) {
  // Stand at the last-seen spot, looking around, then give up and patrol.
  g.searchT -= dt;
  g.scanPhase += dt * 2.2;
  g.heading += Math.sin(g.scanPhase) * 1.4 * dt;
  if (g.searchT <= 0) {
    g.mode = 'patrol';
    // Resume from the nearest waypoint instead of marching across the hall.
    let bestLeg = 0;
    let bestD = Infinity;
    const route = world.floor.guardRoutes[g.id];
    for (let i = 0; i < route.path.length; i += 1) {
      const dd = dist(g.x, g.y, route.path[i].x, route.path[i].y);
      if (dd < bestD) {
        bestD = dd;
        bestLeg = i;
      }
    }
    g.leg = bestLeg;
    g.pausing = 0;
  }
}

function sweepCamera(c, dt) {
  // Ping-pong sweep: heading oscillates around the base aim.
  c.phase += dt * TUNE.camSweep;
  c.heading = c.base + Math.sin(c.phase) * c.sweep;
}

// --- run end -----------------------------------------------------------------

function endRun(world, phase, reason) {
  world.phase = phase;
  world.overReason = reason || '';
  if (phase === 'won' && world.score > world.best) {
    world.best = world.score;
    try {
      window.localStorage.setItem('vaultbreak-best', String(world.best));
    } catch (err) {
      // Storage unavailable: the best score just lives for this session.
    }
  }
}

// Start (or restart) a run from the title / end screens.
export function startRun(world) {
  const seed = world.seed;
  const keepBest = world.best;
  const fresh = freshWorld(seed);
  fresh.best = keepBest;
  fresh.phase = 'playing';
  // Copy the fresh state over the live world object so every reference
  // main.js and shots.js hold keeps working.
  for (const key of Object.keys(fresh)) world[key] = fresh[key];
  world.phase = 'playing';
}

// Human-readable clock: 3:00 counts down to 0:00.
export function clockText(world) {
  const s = Math.max(0, Math.ceil(world.timeLeft));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function alarmLabel(world) {
  if (world.alarm) return 'ALARM!';
  if (world.meter > 0.04) return 'SPOTTED';
  return 'HIDDEN';
}
