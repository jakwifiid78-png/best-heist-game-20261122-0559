// Canvas rendering for Vaultbreak: bank floor, guard cones, camera beams,
// glowing vault loot, getaway van, HUD with the alarm meter, and screens.
// Everything is drawn from the world state; nothing here simulates.

import { FIELD, LEVEL, PALETTE, FONT, GUARD, CAMERA, PLAYER } from './config.js';
import {
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER, SCREEN_WIN, formatMoney, formatTime,
} from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFloor(ctx) {
  ctx.fillStyle = PALETTE.floor;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const tile = 80;
  for (let y = 0; y < FIELD.height; y += tile) {
    for (let x = 0; x < FIELD.width; x += tile) {
      ctx.fillStyle = ((x / tile) + (y / tile)) % 2 === 0 ? PALETTE.floorAlt : PALETTE.floorGold;
      ctx.fillRect(x, y, tile, tile);
    }
  }
  ctx.strokeStyle = 'rgba(255,217,77,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= FIELD.width; x += tile) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height); ctx.stroke();
  }
  for (let y = 0; y <= FIELD.height; y += tile) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); ctx.stroke();
  }
  // Vault room floor: gold-tinted marble.
  ctx.fillStyle = 'rgba(255,217,77,0.08)';
  ctx.fillRect(1004, 24, 252, 176);
  ctx.fillStyle = 'rgba(255,217,77,0.55)';
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('V A U L T', 1130, 46);
  ctx.textAlign = 'left';
  for (const sh of LEVEL.shadows) {
    ctx.fillStyle = PALETTE.shadow;
    roundRect(ctx, sh.x, sh.y, sh.w, sh.h, 18);
    ctx.fill();
    ctx.strokeStyle = PALETTE.shadowEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(238,241,245,0.35)';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('SHADOW — HIDDEN', sh.x + sh.w / 2, sh.y + sh.h / 2);
    ctx.textAlign = 'left';
  }
}

function drawExit(ctx, open, t) {
  const e = LEVEL.exit;
  const pulse = open ? 0.6 + 0.4 * Math.sin(t * 4) : 0.25;
  ctx.fillStyle = open ? PALETTE.exitOpen : PALETTE.exitLocked;
  ctx.globalAlpha = 0.35 + 0.4 * pulse;
  roundRect(ctx, e.x - 6, e.y - 6, e.w + 12, e.h + 12, 10);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Getaway van body.
  ctx.fillStyle = open ? '#1d7a4a' : '#3a3a2e';
  roundRect(ctx, e.x, e.y, e.w, e.h, 8);
  ctx.fill();
  ctx.strokeStyle = open ? '#7fe0a8' : '#8a8358';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(e.x + 24, e.y + e.h - 10, 10, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(e.x + e.w - 24, e.y + e.h - 10, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#eef1f5';
  ctx.font = `bold 14px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(open ? 'GETAWAY' : 'VAN LOCKED', e.x + e.w / 2, e.y + 26);
  ctx.font = `12px ${FONT}`;
  ctx.fillText(open ? 'ESCAPE HERE!' : 'TAKE ALL LOOT', e.x + e.w / 2, e.y + 48);
  ctx.textAlign = 'left';
}

function drawLoot(ctx, loot, t) {
  for (const l of loot) {
    if (l.taken) continue;
    const bob = Math.sin(t * 3 + l.x) * 3;
    const y = l.y + bob;
    const isVault = l.kind === 'vault';
    const glowR = isVault ? 34 + Math.sin(t * 4) * 6 : 22;
    ctx.fillStyle = isVault ? 'rgba(255,217,77,0.28)' : 'rgba(255,217,77,0.14)';
    ctx.beginPath(); ctx.arc(l.x, y, glowR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = isVault ? 'rgba(255,217,77,0.7)' : 'rgba(255,217,77,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(l.x, y, glowR - 4, 0, Math.PI * 2); ctx.stroke();
    if (l.kind === 'vault' || l.kind === 'gold') {
      // Stack of gold bars.
      ctx.fillStyle = PALETTE.loot;
      ctx.fillRect(l.x - 16, y - 4, 32, 12);
      ctx.fillRect(l.x - 11, y - 14, 22, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(l.x - 16, y - 4, 32, 3);
    } else if (l.kind === 'gem') {
      ctx.save();
      ctx.translate(l.x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.gem;
      ctx.fillRect(-10, -10, 20, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(-10, -10, 20, 6);
      ctx.restore();
    } else {
      // Cash stack.
      ctx.fillStyle = PALETTE.cash;
      ctx.fillRect(l.x - 14, y - 9, 28, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(l.x, y, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(formatMoney(l.value), l.x, y - glowR - 2);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
  }
}

function drawFurnitureAndWalls(ctx) {
  for (const c of LEVEL.furniture) {
    ctx.fillStyle = PALETTE.desk;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = PALETTE.deskTop;
    ctx.fillRect(c.x, c.y, c.w, 9);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
  }
  for (const w of LEVEL.walls) {
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = PALETTE.wallTop;
    if (w.h <= w.w) ctx.fillRect(w.x, w.y, w.w, 5);
    else ctx.fillRect(w.x, w.y, 5, w.h);
  }
  // Vault door frame on the vault-room doorway.
  ctx.fillStyle = PALETTE.vaultDoor;
  ctx.fillRect(1080, 200, 8, 24);
  ctx.fillRect(1152, 200, 8, 24);
}

function drawCones(ctx, guards, alarm) {
  for (const g of guards) {
    const alert = alarm || g.mode === 'chase';
    ctx.fillStyle = alert ? PALETTE.coneAlert : PALETTE.cone;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.arc(g.x, g.y, GUARD.range, g.facing - GUARD.coneHalf, g.facing + GUARD.coneHalf);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCameraBeams(ctx, cameras, alarm) {
  for (const cam of cameras) {
    const alert = alarm || cam.seesPlayer;
    ctx.fillStyle = alert ? PALETTE.beamAlert : PALETTE.beam;
    ctx.beginPath();
    ctx.moveTo(cam.x, cam.y);
    ctx.arc(cam.x, cam.y, CAMERA.range, cam.facing - CAMERA.halfAngle, cam.facing + CAMERA.halfAngle);
    ctx.closePath();
    ctx.fill();
    // Sight line down the beam centre.
    ctx.strokeStyle = alert ? 'rgba(255,80,80,0.85)' : 'rgba(255,80,80,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(cam.x, cam.y);
    ctx.lineTo(cam.x + Math.cos(cam.facing) * CAMERA.range, cam.y + Math.sin(cam.facing) * CAMERA.range);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawPatrolPaths(ctx, guards) {
  ctx.strokeStyle = 'rgba(238,241,245,0.10)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 8]);
  for (const g of guards) {
    ctx.beginPath();
    const wps = g.waypoints;
    ctx.moveTo(wps[0][0], wps[0][1]);
    for (let i = 1; i < wps.length; i += 1) ctx.lineTo(wps[i][0], wps[i][1]);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawCamera(ctx, cam, t) {
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(cam.x, cam.y, 11, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = cam.seesPlayer ? '#ff5050' : '#8b93a3';
  ctx.lineWidth = 2;
  ctx.stroke();
  const fx = Math.cos(cam.facing);
  const fy = Math.sin(cam.facing);
  ctx.fillStyle = cam.seesPlayer ? '#ff5050' : '#eef1f5';
  ctx.beginPath(); ctx.arc(cam.x + fx * 8, cam.y + fy * 8, 4, 0, Math.PI * 2); ctx.fill();
  if (cam.seesPlayer) {
    ctx.fillStyle = '#ff5050';
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('CAM!', cam.x, cam.y - 16);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
  }
}

function drawGuard(ctx, g, alarm, t) {
  const alert = alarm || g.mode === 'chase';
  ctx.fillStyle = alert ? PALETTE.guard : PALETTE.guardCalm;
  ctx.beginPath();
  ctx.arc(g.x, g.y, GUARD.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a0d0d';
  ctx.lineWidth = 2;
  ctx.stroke();
  const fx = Math.cos(g.facing);
  const fy = Math.sin(g.facing);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(g.x + fx * GUARD.radius, g.y + fy * GUARD.radius);
  ctx.lineTo(g.x + fx * (GUARD.radius + 10), g.y + fy * (GUARD.radius + 10));
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(g.x + fx * 5 - fy * 5, g.y + fy * 5 + fx * 5, 2.5, 0, Math.PI * 2);
  ctx.arc(g.x + fx * 5 + fy * 5, g.y + fy * 5 - fx * 5, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Cap brim.
  ctx.strokeStyle = '#1a0d0d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(g.x, g.y, GUARD.radius - 3, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  if (alert) {
    ctx.fillStyle = '#fff';
    ctx.font = `bold 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('!', g.x, g.y - GUARD.radius - 6);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
  }
  if (g.mode === 'search') {
    ctx.fillStyle = '#ffd166';
    ctx.font = `bold 18px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('?', g.x, g.y - GUARD.radius - 6);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
  }
}

function drawPlayer(ctx, p, t) {
  ctx.fillStyle = p.sneak ? PALETTE.playerSneak : PALETTE.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a1e05';
  ctx.lineWidth = 2;
  ctx.stroke();
  const fx = Math.cos(p.facing);
  const fy = Math.sin(p.facing);
  // Hood point in the facing direction.
  ctx.fillStyle = '#2a1e05';
  ctx.beginPath();
  ctx.moveTo(p.x + fx * (PLAYER.radius + 8), p.y + fy * (PLAYER.radius + 8));
  ctx.lineTo(p.x - fy * 7 + fx * 4, p.y + fx * 7 + fy * 4);
  ctx.lineTo(p.x + fy * 7 + fx * 4, p.y - fx * 7 + fy * 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(p.x + fx * 4 - fy * 4, p.y + fy * 4 + fx * 4, 2.2, 0, Math.PI * 2);
  ctx.arc(p.x + fx * 4 + fy * 4, p.y + fy * 4 - fx * 4, 2.2, 0, Math.PI * 2);
  ctx.fill();
  if (p.sneak) {
    ctx.strokeStyle = 'rgba(238,241,245,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = '#fff';
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('THIEF', p.x, p.y - PLAYER.radius - 5);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
}

function drawHud(ctx, world, timeLeft) {
  const s = world.state;
  const alarm = s.alarm;
  ctx.fillStyle = alarm ? 'rgba(120,20,20,0.92)' : 'rgba(13,15,20,0.88)';
  ctx.fillRect(0, 0, FIELD.width, 48);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 17px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('VAULTBREAK', 16, 25);
  ctx.fillStyle = PALETTE.loot;
  ctx.fillText(`◆ ${s.lootTaken}/${s.loot.length} loot`, 180, 25);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`Score ${formatMoney(world.score)}`, 330, 25);
  ctx.fillStyle = timeLeft < 30 ? PALETTE.danger : PALETTE.text;
  ctx.fillText(`⏱ ${formatTime(timeLeft)}`, 520, 25);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('♥'.repeat(Math.max(0, s.lives)) + '♡'.repeat(Math.max(0, PLAYER.lives - s.lives)), 640, 25);
  // Alarm meter, labelled, right side.
  const mw = 230;
  const mx = FIELD.width - mw - 16;
  ctx.fillStyle = '#eef1f5';
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('ALARM', mx - 8, 25);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#333';
  roundRect(ctx, mx, 14, mw, 20, 10);
  ctx.fill();
  const d = s.detection;
  ctx.fillStyle = alarm ? PALETTE.danger : d > 0.66 ? PALETTE.danger : d > 0.33 ? '#f2c94c' : '#7fb069';
  if (d > 0.02 || alarm) {
    roundRect(ctx, mx, 14, Math.max(20, mw * Math.max(d, alarm ? 1 : 0)), 20, 10);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(alarm ? 'ALARM!' : d > 0.02 ? 'SPOTTED' : 'HIDDEN', mx + mw / 2, 24);
  ctx.textAlign = 'left';
  // Bottom hint.
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `14px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(
    s.exitOpen
      ? 'Van is open — reach the getaway van, bottom left!'
      : 'WASD / arrows to move · hold Shift to sneak · hide in shadows · dodge cones and camera beams',
    FIELD.width / 2, FIELD.height - 12,
  );
  ctx.textAlign = 'left';
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(10,12,17,0.78)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = accent || PALETTE.text;
  ctx.font = `bold 52px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, FIELD.width / 2, 235);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `20px ${FONT}`;
  lines.forEach((line, i) => {
    ctx.fillText(line, FIELD.width / 2, 305 + i * 34);
  });
  ctx.textAlign = 'left';
}

export function render(ctx, world, t, timeLeft) {
  const s = world.state;
  const tl = timeLeft !== undefined ? timeLeft : world.timeLeft;
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = PALETTE.backdrop;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  drawFloor(ctx);
  drawPatrolPaths(ctx, s.guards);
  drawCones(ctx, s.guards, s.alarm);
  drawCameraBeams(ctx, s.cameras, s.alarm);
  drawExit(ctx, s.exitOpen, t);
  drawLoot(ctx, s.loot, t);
  drawFurnitureAndWalls(ctx);
  for (const cam of s.cameras) drawCamera(ctx, cam, t);
  for (const g of s.guards) drawGuard(ctx, g, s.alarm, t);
  drawPlayer(ctx, s.player, t);
  if (world.screen === SCREEN_PLAY) drawHud(ctx, world, tl);
  if (s.alarm) {
    const flash = 0.10 + 0.08 * Math.sin(s.alarmFlash * 10);
    ctx.fillStyle = `rgba(229,83,75,${Math.max(0.04, flash)})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = '#ff5050';
    ctx.font = `bold 30px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('⚠ ALARM — RUN! ⚠', FIELD.width / 2, 84);
    ctx.textAlign = 'left';
  }
  if (s.caughtFlash > 0) {
    ctx.fillStyle = `rgba(229,83,75,${Math.min(0.35, s.caughtFlash)})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
  if (world.screen === SCREEN_TITLE) {
    overlay(ctx, 'VAULTBREAK', [
      'The Midnight Lift — one bank, one vault, three guards, three cameras.',
      'Lift the $5,000 vault gold and every stash, then reach the getaway van.',
      'You have 3:00 and 3 lives. Cameras sweep — their red beams fill the alarm too.',
      '',
      'Move: WASD / arrows · Sneak (slow, spotted half as fast): hold Shift',
      'Click a spot to walk there · R restart · M mute · Enter to start',
      '',
      'Press Enter or click to begin the heist',
    ], PALETTE.player);
  } else if (world.screen === SCREEN_OVER) {
    overlay(ctx, world.overReason === 'time' ? 'TIME UP!' : 'CAUGHT!', [
      world.overReason === 'time'
        ? 'The clock hit 0:00 — the vault locked down and the crew scattered.'
        : 'The guards closed in three times. The lift is blown.',
      `Loot kept: ${formatMoney(s.lootValue)} · Final score ${formatMoney(world.score)}.`,
      'Press Enter or R to run the heist again',
    ], PALETTE.danger);
  } else if (world.screen === SCREEN_WIN) {
    overlay(ctx, 'CLEAN GETAWAY!', [
      `All loot lifted — ${formatMoney(s.lootValue)} — and out in the van.`,
      `Final score ${formatMoney(world.score)} (time bonus included).`,
      `Best on this machine: ${formatMoney(Math.max(world.best, world.score))}.`,
      'Press Enter or R to pull another job',
    ], PALETTE.player);
  }
  const status = document.getElementById('status');
  if (status) {
    status.textContent = world.screen === SCREEN_PLAY
      ? `${s.lootTaken} of ${s.loot.length} loot, ${formatMoney(world.score)}, ${formatTime(tl)} left, ${s.lives} lives, ${s.alarm ? 'alarm!' : 'hidden'}.`
      : world.screen;
  }
}
