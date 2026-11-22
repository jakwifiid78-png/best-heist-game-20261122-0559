// Vaultbreak — canvas painter. All art is drawn in code: no images, no
// fonts fetched, no assets of any kind. Draw order is deliberate —
// floor, shadows, loot and van, then cones and beams on the floor, then
// the people and cameras, then the HUD, then screens and the alarm banner.
//
// paintScene(ctx, world, visualT) — visualT is seconds for pulsing and
// glow animation; it may keep running while the simulation is frozen
// (screenshot mode), which is what makes a frozen frame still shimmer.

import { VIEW_W, VIEW_H, HUD_H, PALETTE, TUNE } from './config.js';
import { clockText, alarmLabel } from './world.js';
import { wobble } from './random.js';

function rr(ctx, x, y, w, h, r) {
  // Rounded-rect path, no fill or stroke applied.
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, weight, align) {
  ctx.fillStyle = color;
  ctx.font = `${weight || 600} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

export function paintScene(ctx, world, visualT) {
  const floor = world.floor;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  paintFloor(ctx, floor, visualT);
  paintShadows(ctx, floor);
  paintVan(ctx, world, visualT);
  paintLoot(ctx, world, visualT);
  paintCones(ctx, world);
  paintBeams(ctx, world);
  paintBlocks(ctx, floor);
  paintWalls(ctx, floor);
  paintCameras(ctx, world, visualT);
  paintGuards(ctx, world, visualT);
  paintThief(ctx, world, visualT);
  paintHud(ctx, world);
  if (world.phase === 'title') paintTitle(ctx, world, visualT);
  else if (world.phase === 'won') paintWon(ctx, world);
  else if (world.phase === 'over') paintOver(ctx, world);
  if (world.alarm && world.phase === 'playing') paintAlarm(ctx, world, visualT);
  if (world.flash > 0 && world.phase === 'playing') {
    ctx.fillStyle = `rgba(255, 40, 30, ${Math.min(0.28, world.flash * 0.3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

// --- floor -----------------------------------------------------------------

function paintFloor(ctx, floor, visualT) {
  ctx.fillStyle = PALETTE.floorA;
  ctx.fillRect(0, HUD_H, VIEW_W, VIEW_H - HUD_H);
  // Checker tiles, faint, so movement reads at a glance.
  const tile = 64;
  for (let y = HUD_H; y < VIEW_H; y += tile) {
    for (let x = 0; x < VIEW_W; x += tile) {
      if (((x / tile) | 0) % 2 === ((y / tile) | 0) % 2) {
        ctx.fillStyle = PALETTE.floorB;
        ctx.fillRect(x, y, tile, tile);
      }
    }
  }
  ctx.strokeStyle = PALETTE.floorLine;
  ctx.lineWidth = 1;
  for (let x = 0; x <= VIEW_W; x += tile) {
    ctx.beginPath();
    ctx.moveTo(x, HUD_H);
    ctx.lineTo(x, VIEW_H);
    ctx.stroke();
  }
  for (let y = HUD_H; y <= VIEW_H; y += tile) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW_W, y);
    ctx.stroke();
  }
  // Vault carpet, top-right, where the big gold sits.
  ctx.fillStyle = PALETTE.carpet;
  rr(ctx, 1040, 84, 220, 130, 10);
  ctx.fill();
  ctx.strokeStyle = PALETTE.carpetEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, 'VAULT', 1150, 204, 13, PALETTE.textDim, 700, 'center');
  // Entrance mat, bottom-left by the van.
  ctx.fillStyle = PALETTE.carpet;
  rr(ctx, 24, 596, 200, 104, 10);
  ctx.fill();
  ctx.strokeStyle = PALETTE.carpetEdge;
  ctx.stroke();
  text(ctx, 'ENTRANCE', 124, 688, 12, PALETTE.textDim, 700, 'center');
}

function paintShadows(ctx, floor) {
  for (const s of floor.shadows) {
    ctx.fillStyle = PALETTE.shadow;
    rr(ctx, s.x, s.y, s.w, s.h, 14);
    ctx.fill();
    ctx.strokeStyle = PALETTE.shadowEdge;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, 'SHADOW', s.x + s.w / 2, s.y + s.h / 2 + 4, 12, '#5f74ad', 700, 'center');
  }
}

function paintWalls(ctx, floor) {
  for (const w of floor.walls) {
    ctx.fillStyle = PALETTE.wallTop;
    ctx.fillRect(w.x, w.y, w.w, Math.min(4, w.h));
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(w.x, w.y + Math.min(4, w.h), w.w, w.h - Math.min(4, w.h));
  }
}

// --- furniture ---------------------------------------------------------------

function paintBlocks(ctx, floor) {
  for (const b of floor.blocks) {
    if (b.kind === 'desk' || b.kind === 'counter') {
      ctx.fillStyle = PALETTE.desk;
      rr(ctx, b.x, b.y, b.w, b.h, 6);
      ctx.fill();
      ctx.fillStyle = PALETTE.deskTop;
      rr(ctx, b.x + 5, b.y + 5, b.w - 10, b.h - 10, 4);
      ctx.fill();
      // Papers on the desk.
      ctx.fillStyle = 'rgba(238, 241, 248, 0.75)';
      ctx.fillRect(b.x + 12, b.y + 10, 22, 14);
      ctx.fillRect(b.x + b.w - 40, b.y + b.h - 24, 26, 14);
    } else if (b.kind === 'case') {
      ctx.fillStyle = PALETTE.caseFrame;
      rr(ctx, b.x, b.y, b.w, b.h, 6);
      ctx.fill();
      ctx.fillStyle = PALETTE.caseGlass;
      rr(ctx, b.x + 6, b.y + 6, b.w - 12, b.h - 12, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(b.x + 12, b.y + 8, b.w - 24, 5);
    } else {
      // Planter: soil box with three leafy tufts.
      ctx.fillStyle = PALETTE.planter;
      rr(ctx, b.x, b.y + b.h - 26, b.w, 26, 5);
      ctx.fill();
      ctx.fillStyle = PALETTE.plant;
      for (let i = 0; i < 3; i += 1) {
        const cx = b.x + 14 + i * ((b.w - 28) / 2);
        ctx.beginPath();
        ctx.arc(cx, b.y + b.h - 34, 13, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 4, 10, 'rgba(238, 241, 248, 0.55)', 700, 'center');
  }
}

// --- loot and van --------------------------------------------------------------

function paintLoot(ctx, world, visualT) {
  for (const item of world.loot) {
    if (item.taken) continue;
    const pulse = 0.5 + 0.5 * wobble(visualT, item.sparkle, 2.4);
    const glowR = 30 + pulse * 10;
    const grad = ctx.createRadialGradient(item.x, item.y, 4, item.x, item.y, glowR);
    grad.addColorStop(0, item.color);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 0.35 + pulse * 0.25;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(item.x, item.y, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (item.id === 'gem') {
      // Faceted diamond.
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.moveTo(item.x, item.y - 14);
      ctx.lineTo(item.x + 12, item.y);
      ctx.lineTo(item.x, item.y + 14);
      ctx.lineTo(item.x - 12, item.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(item.x, item.y - 14);
      ctx.lineTo(item.x + 12, item.y);
      ctx.lineTo(item.x, item.y);
      ctx.closePath();
      ctx.fill();
    } else if (item.id === 'cash') {
      ctx.fillStyle = item.color;
      rr(ctx, item.x - 15, item.y - 10, 30, 20, 3);
      ctx.fill();
      ctx.fillStyle = '#2c6b28';
      ctx.beginPath();
      ctx.arc(item.x, item.y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Gold: a little pile of bars.
      ctx.fillStyle = PALETTE.goldDeep;
      rr(ctx, item.x - 16, item.y + 2, 32, 10, 3);
      ctx.fill();
      ctx.fillStyle = item.color;
      rr(ctx, item.x - 12, item.y - 6, 24, 10, 3);
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      rr(ctx, item.x - 6, item.y - 12, 12, 8, 2);
      ctx.fill();
    }
    text(ctx, `$${item.value.toLocaleString('en-US')}`, item.x, item.y + 30, 12, item.color, 700, 'center');
    text(ctx, item.label, item.x, item.y - 24, 10, PALETTE.textDim, 700, 'center');
  }
}

function paintVan(ctx, world, visualT) {
  const v = world.floor.van;
  const open = world.vanOpen;
  const pulse = open ? 0.5 + 0.5 * wobble(visualT, 0, 3) : 0;
  if (open) {
    ctx.strokeStyle = `rgba(88, 214, 141, ${0.5 + pulse * 0.5})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    rr(ctx, v.x - 6, v.y - 6, v.w + 12, v.h + 12, 12);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Van body, nose pointing right toward the street.
  ctx.fillStyle = open ? PALETTE.van : '#6e3a34';
  rr(ctx, v.x, v.y + 12, v.w, v.h - 24, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.vanDark;
  rr(ctx, v.x + v.w - 34, v.y + 20, 30, v.h - 40, 6);
  ctx.fill();
  ctx.fillStyle = '#bfe3ff';
  ctx.fillRect(v.x + v.w - 30, v.y + 26, 20, 16);
  ctx.fillStyle = '#20242e';
  ctx.beginPath();
  ctx.arc(v.x + 26, v.y + v.h - 12, 11, 0, Math.PI * 2);
  ctx.arc(v.x + v.w - 26, v.y + v.h - 12, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7c828f';
  ctx.beginPath();
  ctx.arc(v.x + 26, v.y + v.h - 12, 5, 0, Math.PI * 2);
  ctx.arc(v.x + v.w - 26, v.y + v.h - 12, 5, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, open ? 'GETAWAY — GO!' : 'GETAWAY (LOCKED)', v.x + v.w / 2, v.y - 10, 12, open ? '#58d68d' : PALETTE.textDim, 700, 'center');
}

// --- cones and beams -----------------------------------------------------------

function paintCones(ctx, world) {
  for (const g of world.guards) {
    const hot = g.mode !== 'patrol';
    ctx.fillStyle = hot ? PALETTE.coneHot : PALETTE.cone;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.arc(g.x, g.y, TUNE.coneRange, g.heading - TUNE.coneHalf, g.heading + TUNE.coneHalf);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hot ? 'rgba(255, 72, 60, 0.5)' : 'rgba(255, 214, 90, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function paintBeams(ctx, world) {
  for (const c of world.cameras) {
    const ex = c.x + Math.cos(c.heading) * c.range;
    const ey = c.y + Math.sin(c.heading) * c.range;
    // Wide faint wedge so the sweep reads, plus a hard centre line.
    ctx.fillStyle = 'rgba(255, 60, 50, 0.10)';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.arc(c.x, c.y, c.range, c.heading - c.half * 2.2, c.heading + c.half * 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.beam;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff5a4d';
    ctx.beginPath();
    ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- people and cameras ----------------------------------------------------------

function paintCameras(ctx, world, visualT) {
  for (const c of world.cameras) {
    const blink = 0.5 + 0.5 * wobble(visualT, c.id * 2.1, 4);
    ctx.fillStyle = '#2b3247';
    rr(ctx, c.x - 11, c.y - 8, 22, 16, 4);
    ctx.fill();
    ctx.strokeStyle = '#4d5c85';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 70, 60, ${0.5 + blink * 0.5})`;
    ctx.beginPath();
    ctx.arc(c.x + Math.cos(c.heading) * 12, c.y + Math.sin(c.heading) * 12, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintGuards(ctx, world, visualT) {
  for (const g of world.guards) {
    const bob = g.mode === 'patrol' ? Math.sin(visualT * 6 + g.id * 2) * 1.5 : 0;
    // Body: dark uniform with a gold cap and a torch dot.
    ctx.fillStyle = PALETTE.guardDark;
    ctx.beginPath();
    ctx.arc(g.x, g.y + bob * 0.3, TUNE.guardRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(g.x, g.y + bob * 0.3, TUNE.guardRadius - 4, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick.
    ctx.strokeStyle = '#fff2c4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.heading) * 18, g.y + Math.sin(g.heading) * 18);
    ctx.stroke();
    if (g.mode !== 'patrol') {
      text(ctx, '!', g.x, g.y - 22, 18, '#ff5347', 800, 'center');
    }
  }
}

function paintThief(ctx, world, visualT) {
  const t = world.thief;
  const hidden = world.phase === 'playing' && world.meter <= 0.04;
  const bob = t.moving ? Math.sin(visualT * 10) * 1.5 : 0;
  if (t.invuln > 0 && Math.floor(visualT * 8) % 2 === 0) {
    // Blink while invulnerable after a catch.
    return;
  }
  // Soft ring so the thief reads against dark floor.
  ctx.strokeStyle = t.sneaking ? 'rgba(124, 231, 255, 0.8)' : 'rgba(238, 241, 248, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(t.x, t.y + bob * 0.3, t.r + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.thiefCoat;
  ctx.beginPath();
  ctx.arc(t.x, t.y + bob * 0.3, t.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.thief;
  ctx.beginPath();
  ctx.arc(t.x, t.y + bob * 0.3, t.r - 5, 0, Math.PI * 2);
  ctx.fill();
  // Little mask stripe, facing the heading.
  ctx.strokeStyle = '#20242e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(t.x + Math.cos(t.heading) * 4, t.y + Math.sin(t.heading) * 4);
  ctx.lineTo(t.x + Math.cos(t.heading) * (t.r + 1), t.y + Math.sin(t.heading) * (t.r + 1));
  ctx.stroke();
  if (t.sneaking) text(ctx, 'SNEAK', t.x, t.y - 22, 10, '#7ce7ff', 700, 'center');
  if (hidden) text(ctx, 'HIDDEN', t.x, t.y - 22, 10, '#58d68d', 700, 'center');
}

// --- HUD ---------------------------------------------------------------------

function paintHud(ctx, world) {
  ctx.fillStyle = PALETTE.hud;
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = PALETTE.hudLine;
  ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);

  text(ctx, 'VAULTBREAK', 16, 30, 20, PALETTE.text, 800);
  text(ctx, 'THE MIDNIGHT LIFT', 16, 50, 11, PALETTE.textDim, 600);

  // Alarm meter, labelled, with its state word.
  const label = alarmLabel(world);
  text(ctx, 'ALARM', 250, 24, 12, PALETTE.textDim, 700);
  const bx = 250;
  const by = 30;
  const bw = 260;
  const bh = 16;
  ctx.fillStyle = PALETTE.alarmBarBg;
  rr(ctx, bx, by, bw, bh, 8);
  ctx.fill();
  const frac = world.meter;
  if (frac > 0.01) {
    ctx.fillStyle = world.alarm ? PALETTE.alarmBar : frac > 0.6 ? '#ffb347' : PALETTE.okBar;
    rr(ctx, bx, by, Math.max(12, bw * frac), bh, 8);
    ctx.fill();
  }
  ctx.strokeStyle = PALETTE.hudLine;
  ctx.lineWidth = 1.5;
  rr(ctx, bx, by, bw, bh, 8);
  ctx.stroke();
  text(ctx, label, bx + bw + 12, by + 13, 14, world.alarm ? '#ff5347' : label === 'SPOTTED' ? '#ffb347' : '#58d68d', 800);

  // Score, loot pips, timer, lives.
  text(ctx, `$${world.score.toLocaleString('en-US')}`, 640, 32, 22, PALETTE.gold, 800);
  text(ctx, `LOOT ${world.lootGot}/4`, 640, 52, 11, PALETTE.textDim, 600);
  text(ctx, clockText(world), 830, 32, 22, world.timeLeft < 30 ? '#ff5347' : PALETTE.text, 800);
  text(ctx, 'TIME', 830, 52, 11, PALETTE.textDim, 600);
  let hearts = '';
  for (let i = 0; i < world.lives; i += 1) hearts += '♥ ';
  text(ctx, hearts || '—', 960, 32, 20, '#ff6b81', 700);
  text(ctx, 'LIVES', 960, 52, 11, PALETTE.textDim, 600);
  text(ctx, `BEST $${world.best.toLocaleString('en-US')}`, 1120, 32, 13, PALETTE.textDim, 600);
  text(ctx, 'R restart · M mute', 1120, 52, 11, PALETTE.textDim, 600);
}

function paintAlarm(ctx, world, visualT) {
  const pulse = 0.5 + 0.5 * Math.sin(visualT * 6);
  ctx.fillStyle = `rgba(255, 30, 20, ${0.10 + pulse * 0.10})`;
  ctx.fillRect(0, HUD_H, VIEW_W, VIEW_H - HUD_H);
  // Banner across the middle of the HUD strip.
  ctx.fillStyle = '#c22a20';
  ctx.fillRect(0, HUD_H, VIEW_W, 30);
  text(ctx, 'ALARM — RUN!', VIEW_W / 2, HUD_H + 21, 17, '#ffffff', 800, 'center');
}

// --- screens -------------------------------------------------------------------

function dim(ctx) {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function paintTitle(ctx, world, visualT) {
  dim(ctx);
  const lift = Math.sin(visualT * 1.4) * 4;
  text(ctx, 'VAULTBREAK', VIEW_W / 2, 210 + lift, 64, PALETTE.gold, 800, 'center');
  text(ctx, 'THE MIDNIGHT LIFT', VIEW_W / 2, 250 + lift, 24, PALETTE.text, 600, 'center');
  text(ctx, 'Lift $7,500 from the vault. Dodge the cones, beat the beams,', VIEW_W / 2, 310, 17, PALETTE.textDim, 600, 'center');
  text(ctx, 'then reach the getaway van before the 3:00 clock runs out.', VIEW_W / 2, 336, 17, PALETTE.textDim, 600, 'center');
  text(ctx, 'WASD / arrows to move · click to walk · SHIFT to sneak', VIEW_W / 2, 392, 16, PALETTE.text, 600, 'center');
  text(ctx, 'Shadows hide you · desks and cases block sight · R restarts · M mutes', VIEW_W / 2, 420, 16, PALETTE.text, 600, 'center');
  const blink = 0.5 + 0.5 * Math.sin(visualT * 3);
  text(ctx, 'ENTER or CLICK to start', VIEW_W / 2, 480, 20, `rgba(238, 241, 248, ${0.55 + blink * 0.45})`, 700, 'center');
  text(ctx, '3 lives · 3 guards · 3 cameras · 4 stashes', VIEW_W / 2, 530, 14, PALETTE.textDim, 600, 'center');
}

function paintWon(ctx, world) {
  dim(ctx);
  text(ctx, 'CLEAN GETAWAY!', VIEW_W / 2, 260, 56, '#58d68d', 800, 'center');
  text(ctx, `You lifted $${world.score.toLocaleString('en-US')} and vanished into the night.`, VIEW_W / 2, 320, 19, PALETTE.text, 600, 'center');
  text(ctx, `Best: $${world.best.toLocaleString('en-US')}`, VIEW_W / 2, 356, 16, PALETTE.textDim, 600, 'center');
  text(ctx, 'ENTER or CLICK to run it again', VIEW_W / 2, 430, 18, PALETTE.text, 700, 'center');
}

function paintOver(ctx, world) {
  dim(ctx);
  text(ctx, 'BUSTED', VIEW_W / 2, 260, 56, '#ff5347', 800, 'center');
  text(ctx, world.overReason || 'The run is over.', VIEW_W / 2, 320, 19, PALETTE.text, 600, 'center');
  text(ctx, `Score: $${world.score.toLocaleString('en-US')} · Best: $${world.best.toLocaleString('en-US')}`, VIEW_W / 2, 356, 16, PALETTE.textDim, 600, 'center');
  text(ctx, 'ENTER or CLICK to try again', VIEW_W / 2, 430, 18, PALETTE.text, 700, 'center');
}
