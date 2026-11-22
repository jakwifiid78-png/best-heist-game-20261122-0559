// Vaultbreak — seeded random numbers.
// A tiny deterministic generator so a screenshot seed always replays the
// same night: same guard starting spots, same loot sparkle phase, same
// patrol timing. Nothing here touches the network or the clock.

// Mulberry32: small, fast, and good enough for a game night.
export function makeRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Float in [lo, hi).
export function randRange(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

// Integer in [lo, hi] inclusive.
export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// One element of an array, uniformly.
export function randPick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// Fisher-Yates shuffle that returns a new array, leaving the input alone.
export function shuffled(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// A value that wobbles smoothly between -1 and 1, for idle sparkle and
// the glow pulse on loot. Phase is per-item so nothing blinks in unison.
export function wobble(clock, phase, speed) {
  return Math.sin(clock * speed + phase);
}
