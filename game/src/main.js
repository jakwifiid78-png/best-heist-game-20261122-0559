// Vaultbreak — entry point. Boots the canvas, runs the fixed-step loop,
// and wires world events to sounds and to the screen-reader status line.
//
// Two modes, picked by the URL:
//   ?shot=start|play|alarm|end&seed=N — screenshot mode: stage the scene
//     with the autopilot, paint the frozen world, raise window.__shotReady.
//   anything else — the playable game: title, run, win / game over.
//
// No network, no assets, no build step: plain ES modules over static files.

import { freshWorld, stepWorld, startRun, clockText, alarmLabel } from './world.js';
import { paintScene } from './render.js';
import { makeInput, readControl, keyHit, clickHit, endFrame, clearGoto } from './input.js';
import {
  makeAudio,
  ensureAudio,
  setMuted,
  playTick,
  playPickup,
  playUnlock,
  playCaught,
  playWin,
  playLose,
  startSiren,
  stopSiren,
} from './audio.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;

function announce(statusEl, world) {
  if (!statusEl) return;
  const bits = [
    `Alarm ${alarmLabel(world)}`,
    `Score $${world.score}`,
    `Loot ${world.lootGot} of 4`,
    `Time ${clockText(world)}`,
    `Lives ${world.lives}`,
  ];
  if (world.phase === 'title') bits.push('Title screen. Press Enter to start.');
  if (world.phase === 'won') bits.push('You escaped. Clean getaway.');
  if (world.phase === 'over') bits.push(world.overReason || 'Game over.');
  statusEl.textContent = bits.join('. ');
}

function handleEvents(world, audio) {
  for (const ev of world.events) {
    if (ev.type === 'pickup') playPickup(audio);
    else if (ev.type === 'unlock') playUnlock(audio);
    else if (ev.type === 'alarm') startSiren(audio);
    else if (ev.type === 'alarmClear') stopSiren(audio);
    else if (ev.type === 'caught') {
      playCaught(audio);
      stopSiren(audio);
    } else if (ev.type === 'win') {
      stopSiren(audio);
      playWin(audio);
    } else if (ev.type === 'timeout') {
      stopSiren(audio);
      playLose(audio);
    }
  }
}

function boot() {
  const canvas = document.getElementById('game');
  const statusEl = document.getElementById('status');
  if (!canvas) {
    window.__shotError = 'no canvas #game';
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    window.__shotError = 'no 2d context';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || 1) || 1;
  const world = freshWorld(seed);
  const input = makeInput(canvas);
  const audio = makeAudio();

  // --- screenshot mode -----------------------------------------------------
  if (shot) {
    try {
      stageShot(shot, world);
    } catch (err) {
      window.__shotError = String(err && err.message ? err.message : err);
      return;
    }
    const t0 = performance.now();
    const draw = () => {
      paintScene(ctx, world, (performance.now() - t0) / 1000);
      window.requestAnimationFrame(draw);
    };
    paintScene(ctx, world, 0);
    window.__shotReady = true;
    window.requestAnimationFrame(draw);
    return;
  }

  // --- playable mode ---------------------------------------------------------
  let last = performance.now();
  let acc = 0;
  let lastAnnounce = 0;

  const frame = (now) => {
    window.requestAnimationFrame(frame);
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;

    // Screen changes and one-shot keys.
    if (keyHit(input, 'KeyM')) {
      setMuted(audio, !audio.muted);
    }
    if (world.phase !== 'playing') {
      if (keyHit(input, 'Enter') || keyHit(input, 'Space') || clickHit(input)) {
        ensureAudio(audio);
        playTick(audio);
        startRun(world);
        clearGoto(input);
      }
    } else if (keyHit(input, 'KeyR')) {
      ensureAudio(audio);
      startRun(world);
      clearGoto(input);
    }
    if (clickHit(input) && world.phase === 'playing') ensureAudio(audio);

    // Fixed-step simulation so the game plays the same at any refresh rate.
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard < 5) {
      const ctrl = readControl(input);
      stepWorld(world, ctrl, STEP);
      handleEvents(world, audio);
      acc -= STEP;
      guard += 1;
    }
    if (guard >= 5) acc = 0; // a long hitch must not spiral into catch-up

    paintScene(ctx, world, now / 1000);

    if (now - lastAnnounce > 2000) {
      lastAnnounce = now;
      announce(statusEl, world);
    }
    endFrame(input);
  };

  paintScene(ctx, world, 0);
  announce(statusEl, world);
  window.requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
