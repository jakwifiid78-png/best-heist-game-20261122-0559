// Keyboard + mouse input: WASD/arrows to move, Shift to sneak, mouse click
// to set a move target, Enter/Space to confirm on menus, R to restart, M mute.

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    mx: 0,
    my: 0,
    sneak: false,
    click: null, // {x, y} in logical field coordinates, consumed by main
    confirm: false,
    restart: false,
    muted: false,
    attach() {
      window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        keys.add(e.code);
        if (e.code === 'Enter' || e.code === 'Space') input.confirm = true;
        if (e.code === 'KeyR') input.restart = true;
        if (e.code === 'KeyM') input.muted = !input.muted;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => keys.delete(e.code));
      window.addEventListener('blur', () => keys.clear());
      canvas.addEventListener('pointerdown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        input.click = {
          x: (e.clientX - rect.left) * sx,
          y: (e.clientY - rect.top) * sy,
        };
      });
    },
    poll() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      input.mx = x;
      input.my = y;
      input.sneak = keys.has('ShiftLeft') || keys.has('ShiftRight');
      return input;
    },
    takeConfirm() {
      const c = input.confirm;
      input.confirm = false;
      return c;
    },
    takeRestart() {
      const c = input.restart;
      input.restart = false;
      return c;
    },
    takeClick() {
      const c = input.click;
      input.click = null;
      return c;
    },
  };
  return input;
}
