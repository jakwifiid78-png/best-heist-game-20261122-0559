// Line of sight, vision cones and camera beams: pure geometry, no DOM.

// Does the segment (x1,y1)-(x2,y2) cross the rectangle r? Slab method.
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let a = (r.x - x1) / dx;
    let b = (r.x + r.w - x1) / dx;
    if (a > b) { const t = a; a = b; b = t; }
    tmin = Math.max(tmin, a);
    tmax = Math.min(tmax, b);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let a = (r.y - y1) / dy;
    let b = (r.y + r.h - y1) / dy;
    if (a > b) { const t = a; a = b; b = t; }
    tmin = Math.max(tmin, a);
    tmax = Math.min(tmax, b);
    if (tmin > tmax) return false;
  }
  return true;
}

// True when nothing between (x1,y1) and (x2,y2) blocks sight.
export function hasLineOfSight(x1, y1, x2, y2, blockers) {
  for (let i = 0; i < blockers.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, blockers[i])) return false;
  }
  return true;
}

// Smallest absolute angle between a and b, in radians.
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// Is the target inside a cone/beam (angle + range + sight)?
export function inVisionCone(gx, gy, facing, range, halfAngle, tx, ty, blockers) {
  const dx = tx - gx;
  const dy = ty - gy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return { seen: false, dist };
  if (dist < 1) return { seen: true, dist };
  if (angleDiff(Math.atan2(dy, dx), facing) > halfAngle) return { seen: false, dist };
  if (!hasLineOfSight(gx, gy, tx, ty, blockers)) return { seen: false, dist };
  return { seen: true, dist };
}

// Is the point inside any of the rectangles?
export function pointInRects(x, y, rects) {
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  }
  return false;
}

// Circle (x,y,radius) against a rectangle: true when they overlap.
export function circleHitsRect(x, y, radius, r) {
  const cx = Math.max(r.x, Math.min(x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(y, r.y + r.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < radius * radius;
}

// Move a circle by (dx,dy), sliding along walls: try x then y separately.
export function moveCircle(x, y, radius, dx, dy, solids) {
  let nx = x + dx;
  let blocked = false;
  for (let i = 0; i < solids.length; i += 1) {
    if (circleHitsRect(nx, y, radius, solids[i])) { blocked = true; break; }
  }
  if (blocked) nx = x;
  let ny = y + dy;
  blocked = false;
  for (let i = 0; i < solids.length; i += 1) {
    if (circleHitsRect(nx, ny, radius, solids[i])) { blocked = true; break; }
  }
  if (blocked) ny = y;
  return { x: nx, y: ny };
}
