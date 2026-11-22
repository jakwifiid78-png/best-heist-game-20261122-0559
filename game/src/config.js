// Vaultbreak — tuning numbers, palette, and the bank floor itself.
// Everything the simulation and the painter agree on lives here, so a
// balance tweak is one number, not a hunt through the codebase.
//
// The floor is one open banking hall, 1280 x 720, with a 64px HUD strip
// across the top. Play happens between y=76 and y=708. The vault gold
// sits top-right behind a stub wall; the getaway van waits bottom-left.

// Logical canvas size (matches the <canvas> width/height in index.html).
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 64;
export const FLOOR_TOP = 76;
export const FLOOR_BOTTOM = 708;
export const FLOOR_LEFT = 12;
export const FLOOR_RIGHT = 1268;

// Palette: midnight blues for the hall, warm gold for loot, hot red for
// the alarm, amber for guard cones.
export const PALETTE = {
  floorA: '#1b2233',
  floorB: '#171d2b',
  floorLine: '#232c42',
  wall: '#3a4666',
  wallTop: '#4d5c85',
  carpet: '#232a44',
  carpetEdge: '#39436b',
  desk: '#5a4632',
  deskTop: '#7a5f42',
  caseGlass: '#9fc4d8',
  caseFrame: '#4a3a28',
  planter: '#2e5d3a',
  plant: '#4da663',
  shadow: '#0d1322',
  shadowEdge: '#31406b',
  gold: '#ffd34d',
  goldDeep: '#c9931a',
  gem: '#7ce7ff',
  cash: '#8fe388',
  van: '#c94f42',
  vanDark: '#8f2f26',
  thief: '#e8ecf5',
  thiefCoat: '#2f6fd0',
  guard: '#d8b13c',
  guardDark: '#7a5c14',
  cone: 'rgba(255, 214, 90, 0.20)',
  coneHot: 'rgba(255, 72, 60, 0.30)',
  beam: 'rgba(255, 60, 50, 0.55)',
  hud: '#0d1120',
  hudLine: '#2a3352',
  text: '#eef1f8',
  textDim: '#9aa7c4',
  alarmBar: '#ff5347',
  alarmBarBg: '#3a1d22',
  okBar: '#58d68d',
};

// Balance. Rates are fractions of the alarm meter per second.
export const TUNE = {
  timeLimit: 180, // 3:00 on the clock
  lives: 3,
  thiefWalk: 168, // px per second
  thiefSneak: 96,
  thiefRadius: 13,
  guardWalk: 58,
  guardChase: 110,
  guardSearch: 42,
  guardRadius: 14,
  guardPause: 1.15, // seconds a guard stands and scans at each waypoint
  coneRange: 195,
  coneHalf: 0.56, // radians, ~32 degrees each side
  camRange: 280,
  camHalf: 0.13, // narrow beam
  camSweep: 0.55, // radians per second of sweep
  guardFill: 0.5, // base meter fill per second inside a cone
  guardClose: 1.7, // multiplier when the guard is very near
  guardMid: 1.15,
  guardFar: 0.7,
  camFill: 0.34, // flat meter fill per second inside a camera beam
  sneakFactor: 0.5, // sneaking halves how fast you are spotted
  shadowNear: 55, // inside a shadow you are hidden unless closer than this
  meterDrain: 0.24, // meter per second while nobody can see you
  alarmClearAt: 0.45, // alarm switches off once the meter drains to this
  catchDist: 27, // a guard this close while alarmed costs a life
  pickupDist: 32,
  respawnInvuln: 2.5, // seconds of grace after a catch
  searchTime: 3, // seconds a guard searches your last-seen spot
  winBonusPerSec: 5, // dollars per second left on the clock
};

// The four stashes. Values add up to $7,500.
export const LOOT_DEFS = [
  { id: 'vault', label: 'VAULT GOLD', value: 5000, x: 1150, y: 130, color: '#ffd34d' },
  { id: 'gem', label: 'GEM', value: 800, x: 640, y: 300, color: '#7ce7ff' },
  { id: 'cash', label: 'CASH', value: 500, x: 330, y: 600, color: '#8fe388' },
  { id: 'bars', label: 'GOLD BARS', value: 1200, x: 980, y: 620, color: '#ffb347' },
];

// Build the floor: border walls, two interior stub walls, furniture that
// blocks movement and sight, labelled shadow patches, guard patrol loops,
// wall cameras, the van, and the thief's starting spot.
export function buildFloor() {
  const walls = [
    // Border, as four thick rects.
    { x: 0, y: 64, w: 1280, h: 12 },
    { x: 0, y: 708, w: 1280, h: 12 },
    { x: 0, y: 64, w: 12, h: 656 },
    { x: 1268, y: 64, w: 12, h: 656 },
    // Stub wall shielding the vault gold's approach from the top.
    { x: 1010, y: 76, w: 14, h: 64 },
    // Low stub wall mid-floor, splitting the hall's lower half.
    { x: 700, y: 560, w: 14, h: 120 },
  ];

  // Furniture. kind drives how it is painted; every block stops both
  // walking and line of sight, so each one is usable cover.
  const blocks = [
    { x: 330, y: 190, w: 140, h: 55, kind: 'desk', label: 'DESK' },
    { x: 560, y: 120, w: 120, h: 50, kind: 'desk', label: 'DESK' },
    { x: 800, y: 190, w: 110, h: 60, kind: 'case', label: 'DISPLAY CASE' },
    { x: 180, y: 340, w: 70, h: 70, kind: 'planter', label: 'PLANTER' },
    { x: 420, y: 360, w: 170, h: 60, kind: 'desk', label: 'DESK' },
    { x: 700, y: 380, w: 130, h: 70, kind: 'case', label: 'DISPLAY CASE' },
    { x: 1050, y: 300, w: 70, h: 70, kind: 'planter', label: 'PLANTER' },
    { x: 300, y: 520, w: 160, h: 60, kind: 'desk', label: 'DESK' },
    { x: 880, y: 520, w: 180, h: 60, kind: 'counter', label: 'COUNTER' },
    { x: 730, y: 600, w: 70, h: 70, kind: 'planter', label: 'PLANTER' },
  ];

  // Shadow patches, painted on the floor and labelled. Standing in one
  // hides the thief from cones and beams unless a watcher is very close.
  const shadows = [
    { x: 140, y: 200, w: 130, h: 90 },
    { x: 470, y: 470, w: 140, h: 90 },
    { x: 880, y: 280, w: 130, h: 90 },
    { x: 1100, y: 540, w: 120, h: 80 },
  ];

  // Three patrol loops, each a closed ring of waypoints. Waypoints were
  // picked so no leg crosses a block or a stub wall.
  const guardRoutes = [
    {
      path: [
        { x: 220, y: 110 },
        { x: 760, y: 110 },
        { x: 760, y: 250 },
        { x: 220, y: 250 },
      ],
    },
    {
      path: [
        { x: 1000, y: 150 },
        { x: 1180, y: 150 },
        { x: 1180, y: 430 },
        { x: 1000, y: 430 },
      ],
    },
    {
      path: [
        { x: 200, y: 470 },
        { x: 620, y: 470 },
        { x: 620, y: 650 },
        { x: 200, y: 650 },
      ],
    },
  ];

  // Three wall cameras. base is the resting aim in radians (0 = east,
  // PI/2 = south); each sweeps back and forth around it.
  const cameras = [
    { x: 640, y: 82, base: Math.PI / 2, sweep: 0.96, range: 270 },
    { x: 1262, y: 380, base: Math.PI, sweep: 0.78, range: 280 },
    { x: 18, y: 300, base: 0, sweep: 0.78, range: 260 },
  ];

  return {
    walls,
    blocks,
    shadows,
    lootSpots: LOOT_DEFS,
    guardRoutes,
    cameras,
    van: { x: 55, y: 600, w: 115, h: 95 },
    spawn: { x: 195, y: 655 },
  };
}

// Everything solid on the floor, for movement and sight checks.
export function solidRects(floor) {
  return floor.walls.concat(floor.blocks);
}
