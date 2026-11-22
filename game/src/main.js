// Vaultbreak entry point: fixed-step loop, menus, click-to-move, sounds.
// With ?shot=<name> it stages one screenshot scene, draws one frame and
// sets window.__shotReady so the screenshot runner knows it is done.

import { FIELD, STEP, BEST_KEY } from './config.js';
import { createWorld, stepWorld, SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER, SCREEN_WIN, EVENT_LOOT, EVENT_VAULT, EVENT_CAUGHT, EVENT_ALARM, EVENT_WIN, EVENT_OVER, EVENT_UNLOCK } from './world.js';
import { render } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const audio = createAudio();
const input = createInput(canvas);
input.attach();

const world = createWorld();
world.best = Number(window.localStorage.getItem(BEST_KEY) || 0);
world.toTitle();

let clickTarget = null;
let lastStep = 0;
let acc = 0;
let lastTime = 0;

function playEventSound(events) {
  if (events & EVENT_VAULT) audio.vault();
  else if (events & EVENT_LOOT) audio.loot();
  if (events & EVENT_ALARM) audio.alarm();
  if (events & EVENT_CAUGHT) audio.caught();
  if (events & EVENT_UNLOCK) audio.unlockDoor();
  if (events & EVENT_WIN) audio.win();
}

function saveBest() {
  if (world.score > world.best) {
    world.best = world.score;
    try { window.localStorage.setItem(BEST_KEY, String(world.best)); } catch { /* private mode */ }
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!lastTime) lastTime = now;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  const polled = input.poll();
  audio.setMuted(input.muted);
  if (input.takeRestart()) {
    audio.unlock();
    saveBest();
    world.startRun();
    clickTarget = null;
  }
  const click = input.takeClick();
  if (click) {
    audio.unlock();
    if (world.screen === SCREEN_TITLE) {
      world.startRun();
    } else if (world.screen === SCREEN_OVER || world.screen === SCREEN_WIN) {
      saveBest();
      world.startRun();
    } else {
      clickTarget = click;
    }
  }
  if (input.takeConfirm()) {
    audio.unlock();
    if (world.screen === SCREEN_TITLE) world.startRun();
    else if (world.screen === SCREEN_OVER || world.screen === SCREEN_WIN) {
      saveBest();
      world.startRun();
    }
  }
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    acc -= STEP;
    steps += 1;
    if (world.screen === SCREEN_PLAY) {
      let mx = polled.mx;
      let my = polled.my;
      if (mx === 0 && my === 0 && clickTarget) {
        const p = world.state.player;
        const dx = clickTarget.x - p.x;
        const dy = clickTarget.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 8) clickTarget = null;
        else { mx = dx / d; my = dy / d; }
      } else if (mx !== 0 || my !== 0) {
        clickTarget = null;
      }
      const events = stepWorld(world, STEP, { mx, my, sneak: polled.sneak });
      playEventSound(events);
      if (events & (EVENT_OVER | EVENT_WIN)) saveBest();
      lastStep += 1;
      if (lastStep % 40 === 0 && polled.mx === 0 && polled.my === 0 && world.state.player.moving) audio.step();
    }
  }
  render(ctx, world, now / 1000, world.timeLeft);
}

if (shotName) {
  try {
    const staged = stageShot(shotName, world);
    world.screen = staged.screen;
    world.best = staged.best;
    render(ctx, world, 1.5, world.timeLeft);
    window.__shotReady = true;
  } catch (err) {
    window.__shotError = String(err && err.message ? err.message : err);
  }
} else {
  requestAnimationFrame(frame);
}
