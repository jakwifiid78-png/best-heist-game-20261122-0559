// Vaultbreak — keyboard and mouse input.
// The world never reads the DOM itself: this module turns raw events into
// a plain control object { mx, my, sneak, goto } plus edge-triggered
// "was pressed" answers for Enter, R, M and clicks. main.js polls it once
// per frame and calls endFrame() to clear the edges.

import { VIEW_W, VIEW_H } from './config.js';

const MOVE_KEYS = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export function makeInput(canvas) {
  const input = {
    held: new Set(),
    edges: new Set(),
    clicked: false,
    clickX: 0,
    clickY: 0,
    goto: null,
    canvas,
  };

  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'ArrowUp' || ev.code === 'ArrowDown' || ev.code === 'ArrowLeft' || ev.code === 'ArrowRight' || ev.code === 'Space') {
      ev.preventDefault(); // keep the page from scrolling on arrows/space
    }
    if (!ev.repeat) input.edges.add(ev.code);
    input.held.add(ev.code);
  });
  window.addEventListener('keyup', (ev) => {
    input.held.delete(ev.code);
  });
  window.addEventListener('blur', () => {
    input.held.clear(); // never keep walking after the window loses focus
  });

  canvas.addEventListener('pointerdown', (ev) => {
    const rect = canvas.getBoundingClientRect();
    const sx = VIEW_W / rect.width;
    const sy = VIEW_H / rect.height;
    input.clickX = (ev.clientX - rect.left) * sx;
    input.clickY = (ev.clientY - rect.top) * sy;
    input.clicked = true;
    input.goto = { x: input.clickX, y: input.clickY };
  });

  return input;
}

// Read the current movement wish from held keys, falling back to the
// click-to-move destination when no key is held.
export function readControl(input) {
  let mx = 0;
  let my = 0;
  if (input.held.has('KeyA') || input.held.has('ArrowLeft')) mx -= 1;
  if (input.held.has('KeyD') || input.held.has('ArrowRight')) mx += 1;
  if (input.held.has('KeyW') || input.held.has('ArrowUp')) my -= 1;
  if (input.held.has('KeyS') || input.held.has('ArrowDown')) my += 1;
  const sneak = input.held.has('ShiftLeft') || input.held.has('ShiftRight');
  return { mx, my, sneak, goto: input.goto };
}

// True once for the frame in which the key went down.
export function keyHit(input, code) {
  return input.edges.has(code);
}

// True once for the frame in which the canvas was tapped/clicked.
export function clickHit(input) {
  return input.clicked;
}

// Forget this frame's taps and key edges. Call once per frame, after the
// world has been stepped.
export function endFrame(input) {
  input.edges.clear();
  input.clicked = false;
}

// Clear a stale click destination (a key press does this implicitly in
// the world, but restarts and screen changes do it explicitly).
export function clearGoto(input) {
  input.goto = null;
}
