// Vaultbreak: The Midnight Lift — tuning, palette and the single bank floor.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** The whole job must be done before the clock runs out (seconds). */
export const TIME_LIMIT = 180;

export const PLAYER = {
  radius: 14,
  walkSpeed: 180,
  sneakSpeed: 95,
  lives: 3,
};

export const GUARD = {
  radius: 14,
  /** Half-angle of a guard's vision cone, in radians. */
  coneHalf: 0.62,
  /** How far a guard can see, in pixels. */
  range: 240,
  /** Detection fills this fast at point blank, slower at the cone's edge. */
  detectNear: 1.5,
  detectFar: 0.55,
  /** Sneaking halves how fast the meter fills. */
  sneakFactor: 0.5,
  /** In a shadow the meter does not fill unless the guard is this close. */
  shadowClose: 75,
  /** How fast the meter drains while unseen. */
  decay: 0.55,
  /** A guard that touches the player while alarmed catches them. */
  catchDistance: 30,
  /** Seconds a guard searches the last-seen spot before giving up. */
  searchTime: 3.0,
};

export const CAMERA = {
  /** Half-angle of a camera's sight beam, in radians (narrow). */
  halfAngle: 0.30,
  /** How far a camera can see, in pixels. */
  range: 300,
  /** Detection rate while a camera has the thief in its beam. */
  detectRate: 0.9,
};

export const PALETTE = {
  backdrop: '#0b0d12',
  floor: '#1c1a24',
  floorAlt: '#201e2b',
  floorGold: '#262033',
  wall: '#3d3a52',
  wallTop: '#545070',
  crate: '#6b4f2a',
  crateTop: '#8a6a3a',
  desk: '#4a3b2c',
  deskTop: '#6b5638',
  shadow: '#0e1220',
  shadowEdge: '#232c42',
  vaultDoor: '#8a6d1f',
  vaultGlow: '#ffd94d',
  exitLocked: '#3d3a2a',
  exitOpen: '#2fae6e',
  player: '#ffd94d',
  playerSneak: '#c9a52b',
  guard: '#e5534b',
  guardCalm: '#d97b4f',
  cone: 'rgba(242, 201, 76, 0.20)',
  coneAlert: 'rgba(229, 83, 75, 0.30)',
  beam: 'rgba(255, 80, 80, 0.16)',
  beamAlert: 'rgba(255, 80, 80, 0.34)',
  loot: '#ffd94d',
  gem: '#7fe0e0',
  cash: '#7fe0a8',
  text: '#eef1f5',
  muted: '#8b93a3',
  panel: '#222735',
  danger: '#e5534b',
  ok: '#2fae6e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'vaultbreak-midnight-lift.best';

// ---------------------------------------------------------------------------
// The bank. Walls and furniture are rectangles {x, y, w, h}. Furniture
// blocks both movement and sight; walls block movement and sight; shadows
// hide the thief. Guards patrol their waypoints, pausing `pause` seconds
// at each one. Cameras are fixed to a wall and sweep back and forth.
// Loot is {x, y, value, kind}; the getaway van unlocks once all of it
// is taken. The vault loot is the big glowing target, top right.
// ---------------------------------------------------------------------------

export const LEVEL = {
  name: 'Midnight Bank — The Vault Floor',
  intro: 'Lift the vault gold and every stash, then reach the getaway van. Cameras sweep, guards patrol.',
  start: { x: 210, y: 640 },
  exit: { x: 24, y: 616, w: 104, h: 80 },
  walls: [
    { x: 0, y: 0, w: 1280, h: 24 },
    { x: 0, y: 696, w: 1280, h: 24 },
    { x: 0, y: 0, w: 24, h: 720 },
    { x: 1256, y: 0, w: 24, h: 720 },
    // Partition: lobby / teller hall, gap at the bottom.
    { x: 440, y: 24, w: 24, h: 336 },
    // Partition: office wing, gap at the top.
    { x: 860, y: 360, w: 24, h: 336 },
    // Teller counter wall with a gap in the middle.
    { x: 464, y: 360, w: 200, h: 24 },
    { x: 744, y: 360, w: 140, h: 24 },
    // Vault room (top right): west wall, then south wall in two parts
    // leaving a doorway gap between x 1080 and 1160.
    { x: 980, y: 24, w: 24, h: 176 },
    { x: 980, y: 200, w: 100, h: 24 },
    { x: 1160, y: 200, w: 96, h: 24 },
  ],
  furniture: [
    // Teller desks, left hall.
    { x: 140, y: 150, w: 150, h: 54 },
    { x: 140, y: 260, w: 150, h: 54 },
    // Display cases, centre hall.
    { x: 560, y: 130, w: 100, h: 64 },
    { x: 700, y: 130, w: 100, h: 64 },
    { x: 560, y: 480, w: 100, h: 64 },
    // Office desks, right wing.
    { x: 960, y: 460, w: 120, h: 56 },
    { x: 1120, y: 560, w: 110, h: 56 },
    // Planters / safes as cover.
    { x: 340, y: 500, w: 64, h: 64 },
    { x: 760, y: 250, w: 64, h: 64 },
  ],
  shadows: [
    { x: 90, y: 420, w: 170, h: 110 },
    { x: 520, y: 480, w: 170, h: 110 },
    { x: 1020, y: 420, w: 150, h: 100 },
    { x: 640, y: 230, w: 150, h: 90 },
    { x: 300, y: 600, w: 150, h: 70 },
  ],
  loot: [
    { x: 1140, y: 110, value: 5000, kind: 'vault' },
    { x: 620, y: 165, value: 800, kind: 'gem' },
    { x: 240, y: 470, value: 500, kind: 'cash' },
    { x: 760, y: 610, value: 1200, kind: 'gold' },
  ],
  guards: [
    {
      waypoints: [[330, 90], [330, 560], [400, 560], [400, 90]],
      speed: 64, pause: 1.2,
    },
    {
      waypoints: [[700, 450], [700, 640], [820, 640], [820, 450]],
      speed: 60, pause: 1.4,
    },
    {
      waypoints: [[1060, 300], [1060, 640], [1200, 640], [1200, 300]],
      speed: 66, pause: 1.0,
    },
  ],
  cameras: [
    // Ceiling camera over the centre hall, sweeping down the hall.
    { x: 640, y: 24, base: Math.PI / 2, sweep: 0.7, speed: 0.55 },
    // Vault-room camera on the south wall, sweeping the doorway.
    { x: 1120, y: 224, base: Math.PI / 2, sweep: 0.6, speed: 0.7 },
    // East-wall camera over the office wing, sweeping west.
    { x: 1256, y: 380, base: Math.PI, sweep: 0.65, speed: 0.5 },
  ],
};
