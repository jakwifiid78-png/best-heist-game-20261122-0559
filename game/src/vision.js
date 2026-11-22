// Vaultbreak — geometry: sight lines, vision cones, camera beams, and
// the circle-vs-rectangle pushing that keeps walkers out of furniture.
// Every "can X see Y" question in the game goes through here, so the
// autopilot, the guards, and the cameras all judge the same world.

// Clamp a number into [lo, hi].
export function clampN(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Squared distance between two points (avoids a sqrt when only a
// comparison is needed).
export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

// Shortest signed turn from angle `from` to angle `to`, in (-PI, PI].
export function angleDiff(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// Is point (px, py) inside the wedge of an observer at (ox, oy) who
// looks along `heading`, sees out to `range`, and has a half-angle of
// `half` radians on each side?
export function inWedge(px, py, ox, oy, heading, range, half) {
  const dx = px - ox;
  const dy = py - oy;
  const d2 = dx * dx + dy * dy;
  if (d2 > range * range || d2 < 1) return false;
  const want = Math.atan2(dy, dx);
  return Math.abs(angleDiff(heading, want)) <= half;
}

// Liang-Barsky clipping: does the segment (x1,y1)-(x2,y2) touch or cross
// the rectangle r? Exact, no sampling, no missed corners.
export function segHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i += 1) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

// True when nothing solid stands between the two points. `solids` is the
// flat list of walls + furniture rects.
export function losClear(ax, ay, bx, by, solids) {
  for (let i = 0; i < solids.length; i += 1) {
    if (segHitsRect(ax, ay, bx, by, solids[i])) return false;
  }
  return true;
}

// Is the point inside any solid rect (optionally grown by `pad` px, so a
// walker with a radius can test where its centre may go)?
export function insideSolids(px, py, solids, pad) {
  const p = pad || 0;
  for (let i = 0; i < solids.length; i += 1) {
    const r = solids[i];
    if (px > r.x - p && px < r.x + r.w + p && py > r.y - p && py < r.y + r.h + p) {
      return true;
    }
  }
  return false;
}

// Push a circle (centre px,py, radius r) out of a single rect. Returns
// the corrected centre, or the input unchanged when there is no overlap.
// When the centre is deep inside the rect, push out along the smallest
// penetration axis.
export function pushCircleOut(px, py, r, rect) {
  const cx = clampN(px, rect.x, rect.x + rect.w);
  const cy = clampN(py, rect.y, rect.y + rect.h);
  const dx = px - cx;
  const dy = py - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return { x: px, y: py, hit: false };
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    const push = (r - d) / d;
    return { x: px + dx * push, y: py + dy * push, hit: true };
  }
  // Centre inside the rect: escape through the nearest face.
  const left = px - rect.x;
  const right = rect.x + rect.w - px;
  const top = py - rect.y;
  const bottom = rect.y + rect.h - py;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: rect.x - r, y: py, hit: true };
  if (m === right) return { x: rect.x + rect.w + r, y: py, hit: true };
  if (m === top) return { x: px, y: rect.y - r, hit: true };
  return { x: px, y: rect.y + rect.h + r, hit: true };
}

// Move a circle by (dx, dy) one axis at a time, sliding along solids
// instead of sticking on corners. Returns the new centre.
export function slideCircle(px, py, r, dx, dy, solids) {
  let nx = px + dx;
  let ny = py;
  for (let i = 0; i < solids.length; i += 1) {
    const out = pushCircleOut(nx, ny, r, solids[i]);
    nx = out.x;
    ny = out.y;
  }
  let fx = nx;
  let fy = py + dy;
  for (let i = 0; i < solids.length; i += 1) {
    const out = pushCircleOut(fx, fy, r, solids[i]);
    fx = out.x;
    fy = out.y;
  }
  return { x: fx, y: fy };
}

// Is the point inside one of the shadow patches?
export function inShadow(px, py, shadows) {
  for (let i = 0; i < shadows.length; i += 1) {
    const s = shadows[i];
    if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) return true;
  }
  return false;
}

// Full sight test for one watcher (guard cone or camera beam): in the
// wedge, line of sight clear, and not hidden by shadow unless the
// watcher is very close. Returns 0 when unseen, otherwise a 0..1
// "how well seen" weight (1 up close, fading with distance).
export function sightWeight(watcher, tx, ty, floor, solids, nearDist) {
  const d = dist(watcher.x, watcher.y, tx, ty);
  if (d > watcher.range) return 0;
  if (!inWedge(tx, ty, watcher.x, watcher.y, watcher.heading, watcher.range, watcher.half)) {
    return 0;
  }
  if (!losClear(watcher.x, watcher.y, tx, ty, solids)) return 0;
  if (inShadow(tx, ty, floor.shadows) && d > nearDist) return 0;
  const t = clampN(d / watcher.range, 0, 1);
  return 1 - t * 0.55;
}
