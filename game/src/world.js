// Vaultbreak simulation: one bank floor, no DOM, no randomness.
// Screens: title, play, over, win. The clock counts down from 3:00;
// the getaway van unlocks once every loot item is taken.

import { FIELD, PLAYER, GUARD, CAMERA, LEVEL, TIME_LIMIT, STEP } from './config.js';
import { inVisionCone, pointInRects, moveCircle } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

export const EVENT_NONE = 0;
export const EVENT_LOOT = 1;
export const EVENT_VAULT = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_ALARM = 8;
export const EVENT_WIN = 16;
export const EVENT_OVER = 32;
export const EVENT_UNLOCK = 64;

export function formatMoney(n) {
  return '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function createWorld() {
  const world = {
    state: null,
    screen: SCREEN_TITLE,
    score: 0,
    best: 0,
    runTime: 0,
    timeLeft: TIME_LIMIT,
    overReason: '',
  };
  world.reset = function reset() {
    const solids = LEVEL.walls.concat(LEVEL.furniture);
    world.timeLeft = TIME_LIMIT;
    world.runTime = 0;
    world.overReason = '';
    world.state = {
      player: { x: LEVEL.start.x, y: LEVEL.start.y, facing: -Math.PI / 2, sneak: false, moving: false },
      guards: LEVEL.guards.map((g) => ({
        x: g.waypoints[0][0],
        y: g.waypoints[0][1],
        facing: Math.atan2(
          g.waypoints[1][1] - g.waypoints[0][1],
          g.waypoints[1][0] - g.waypoints[0][0],
        ),
        wp: 1,
        pauseLeft: 0,
        mode: 'patrol',
        lastSeen: null,
        searchLeft: 0,
        scanDir: 1,
        speed: g.speed,
        pause: g.pause,
        waypoints: g.waypoints,
      })),
      cameras: LEVEL.cameras.map((c) => ({
        x: c.x, y: c.y, base: c.base, sweep: c.sweep, speed: c.speed,
        phase: 0, facing: c.base, seesPlayer: false,
      })),
      loot: LEVEL.loot.map((l) => ({ x: l.x, y: l.y, value: l.value, kind: l.kind, taken: false })),
      detection: 0,
      alarm: false,
      alarmFlash: 0,
      lives: PLAYER.lives,
      lootTaken: 0,
      lootValue: 0,
      exitOpen: false,
      caughtFlash: 0,
    };
    world.screen = SCREEN_PLAY;
    return world.state;
  };
  world.toTitle = function toTitle() {
    world.reset();
    world.screen = SCREEN_TITLE;
  };
  world.startRun = function startRun() {
    world.score = 0;
    world.reset();
  };
  return world;
}

function guardSeesPlayer(guard, player, solids) {
  const hidden = pointInRects(player.x, player.y, LEVEL.shadows);
  const res = inVisionCone(
    guard.x, guard.y, guard.facing, GUARD.range, GUARD.coneHalf,
    player.x, player.y, solids,
  );
  if (!res.seen) return { seen: false, dist: res.dist, hidden };
  if (hidden && res.dist > GUARD.shadowClose) return { seen: false, dist: res.dist, hidden };
  return { seen: true, dist: res.dist, hidden };
}

function cameraSeesPlayer(cam, player, solids) {
  const hidden = pointInRects(player.x, player.y, LEVEL.shadows);
  const res = inVisionCone(
    cam.x, cam.y, cam.facing, CAMERA.range, CAMERA.halfAngle,
    player.x, player.y, solids,
  );
  if (!res.seen) return { seen: false, dist: res.dist };
  if (hidden && res.dist > GUARD.shadowClose) return { seen: false, dist: res.dist };
  return { seen: true, dist: res.dist };
}

export function stepWorld(world, dt, input) {
  const s = world.state;
  const solids = LEVEL.walls.concat(LEVEL.furniture);
  let events = EVENT_NONE;
  world.runTime += dt;
  world.timeLeft -= dt;
  if (s.caughtFlash > 0) s.caughtFlash -= dt;
  if (s.alarm) s.alarmFlash += dt;

  // --- the clock: out of time ends the job ---
  if (world.timeLeft <= 0 && world.screen === SCREEN_PLAY) {
    world.timeLeft = 0;
    world.screen = SCREEN_OVER;
    world.overReason = 'time';
    return EVENT_OVER;
  }

  // --- player movement ---
  const speed = input.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  let mx = input.mx || 0;
  let my = input.my || 0;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  const p = s.player;
  p.sneak = !!input.sneak;
  p.moving = len > 0.1;
  if (p.moving) p.facing = Math.atan2(my, mx);
  const moved = moveCircle(p.x, p.y, PLAYER.radius, mx * speed * dt, my * speed * dt, solids);
  p.x = moved.x;
  p.y = moved.y;

  // --- cameras sweep ---
  for (const cam of s.cameras) {
    cam.phase += cam.speed * dt;
    cam.facing = cam.base + Math.sin(cam.phase) * cam.sweep;
  }

  // --- loot: the vault gold is the big one, the rest are stashes ---
  for (let i = 0; i < s.loot.length; i += 1) {
    const l = s.loot[i];
    if (!l.taken && Math.hypot(l.x - p.x, l.y - p.y) < 30) {
      l.taken = true;
      s.lootTaken += 1;
      s.lootValue += l.value;
      world.score += l.value;
      events |= l.kind === 'vault' ? EVENT_VAULT : EVENT_LOOT;
      if (s.lootTaken === s.loot.length) {
        s.exitOpen = true;
        events |= EVENT_UNLOCK;
      }
    }
  }

  // --- guards: vision, detection, modes ---
  let anyoneSees = false;
  let nearestSeen = Infinity;
  let camSees = false;
  for (const cam of s.cameras) {
    const see = cameraSeesPlayer(cam, p, solids);
    cam.seesPlayer = see.seen;
    if (see.seen) camSees = true;
  }
  for (let i = 0; i < s.guards.length; i += 1) {
    const g = s.guards[i];
    const see = guardSeesPlayer(g, p, LEVEL, solids);
    if (see.seen) {
      anyoneSees = true;
      if (see.dist < nearestSeen) nearestSeen = see.dist;
      g.lastSeen = { x: p.x, y: p.y };
    }
    if (s.alarm && g.mode !== 'chase') g.mode = 'chase';
    if (g.mode === 'patrol') {
      if (g.pauseLeft > 0) {
        g.pauseLeft -= dt;
        g.facing += g.scanDir * 0.9 * dt;
        if (g.facing > Math.PI) g.scanDir = -1;
        if (g.facing < -Math.PI) g.scanDir = 1;
      } else {
        const target = g.waypoints[g.wp];
        const dx = target[0] - g.x;
        const dy = target[1] - g.y;
        const d = Math.hypot(dx, dy);
        if (d < 6) {
          g.wp = (g.wp + 1) % g.waypoints.length;
          g.pauseLeft = g.pause;
        } else {
          g.facing = Math.atan2(dy, dx);
          const step = Math.min(d, g.speed * dt);
          const m = moveCircle(g.x, g.y, GUARD.radius, (dx / d) * step, (dy / d) * step, solids);
          g.x = m.x;
          g.y = m.y;
        }
      }
    } else if (g.mode === 'chase') {
      const target = anyoneSees ? { x: p.x, y: p.y } : g.lastSeen;
      if (target) {
        const dx = target.x - g.x;
        const dy = target.y - g.y;
        const d = Math.hypot(dx, dy);
        if (d > 4) {
          g.facing = Math.atan2(dy, dx);
          const step = Math.min(d, g.speed * 1.55 * dt);
          const m = moveCircle(g.x, g.y, GUARD.radius, (dx / d) * step, (dy / d) * step, solids);
          g.x = m.x;
          g.y = m.y;
        } else if (!anyoneSees) {
          g.mode = 'search';
          g.searchLeft = GUARD.searchTime;
        }
      } else {
        g.mode = 'patrol';
      }
    } else if (g.mode === 'search') {
      g.facing += 1.4 * dt;
      g.searchLeft -= dt;
      if (g.searchLeft <= 0) g.mode = 'patrol';
    }
  }

  // --- detection (alarm) meter: guards fill it by distance, cameras flat ---
  if (anyoneSees) {
    const t = Math.max(0, Math.min(1, 1 - nearestSeen / GUARD.range));
    let rate = GUARD.detectFar + (GUARD.detectNear - GUARD.detectFar) * t;
    if (p.sneak) rate *= GUARD.sneakFactor;
    s.detection = Math.min(1, s.detection + rate * dt);
  } else if (camSees) {
    let rate = CAMERA.detectRate;
    if (p.sneak) rate *= GUARD.sneakFactor;
    s.detection = Math.min(1, s.detection + rate * dt);
  } else {
    s.detection = Math.max(0, s.detection - GUARD.decay * dt);
  }
  if (s.detection >= 1 && !s.alarm) {
    s.alarm = true;
    s.alarmFlash = 0;
    events |= EVENT_ALARM;
    for (let i = 0; i < s.guards.length; i += 1) s.guards[i].mode = 'chase';
  }
  if (s.alarm && s.detection <= 0.45) {
    s.alarm = false;
    for (let i = 0; i < s.guards.length; i += 1) {
      if (s.guards[i].mode === 'chase') s.guards[i].mode = 'search';
      s.guards[i].searchLeft = Math.max(s.guards[i].searchLeft, 1.2);
    }
  }

  // --- caught? A guard that touches the thief while alarmed costs a life. ---
  if (s.alarm) {
    for (let i = 0; i < s.guards.length; i += 1) {
      const g = s.guards[i];
      if (Math.hypot(g.x - p.x, g.y - p.y) < GUARD.catchDistance) {
        s.lives -= 1;
        s.caughtFlash = 0.6;
        events |= EVENT_CAUGHT;
        if (s.lives <= 0) {
          world.screen = SCREEN_OVER;
          world.overReason = 'caught';
          events |= EVENT_OVER;
        } else {
          p.x = LEVEL.start.x;
          p.y = LEVEL.start.y;
          s.detection = 0;
          s.alarm = false;
          for (let j = 0; j < s.guards.length; j += 1) {
            const gg = s.guards[j];
            gg.mode = 'patrol';
            gg.x = gg.waypoints[0][0];
            gg.y = gg.waypoints[0][1];
            gg.wp = 1;
            gg.pauseLeft = 0;
            gg.lastSeen = null;
          }
        }
        break;
      }
    }
  }

  // --- escape: the getaway van, bottom left, once all loot is taken ---
  if (s.exitOpen && world.screen === SCREEN_PLAY) {
    const e = LEVEL.exit;
    if (p.x > e.x && p.x < e.x + e.w && p.y > e.y && p.y < e.y + e.h) {
      const timeBonus = Math.max(0, Math.round(world.timeLeft * 5));
      world.score += timeBonus;
      world.screen = SCREEN_WIN;
      events |= EVENT_WIN;
    }
  }
  return events;
}

export { STEP };
