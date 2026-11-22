// Tiny WebAudio sounds, generated at runtime: no audio assets to ship.
// Every sound is a short oscillator envelope; muted silences them all.
// The alarm is a two-tone siren; loot is a coin chime.

export function createAudio() {
  let ctx = null;
  let muted = false;
  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  return {
    setMuted(m) { muted = m; },
    unlock() { ensure(); },
    loot() { tone(988, 0.1, 'sine', 0.12); setTimeout(() => tone(1319, 0.18, 'sine', 0.1), 70); },
    vault() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.11), i * 80)); },
    alarm() {
      tone(620, 0.28, 'sawtooth', 0.09, 880);
      setTimeout(() => tone(880, 0.28, 'sawtooth', 0.09, 620), 280);
      setTimeout(() => tone(620, 0.28, 'sawtooth', 0.08, 880), 560);
    },
    caught() { tone(330, 0.4, 'square', 0.08, 110); },
    unlockDoor() { tone(523, 0.1, 'triangle', 0.1); setTimeout(() => tone(784, 0.18, 'triangle', 0.1), 90); },
    win() { [523, 659, 784, 1046, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.1), i * 100)); },
    step() { tone(140, 0.05, 'sine', 0.03); },
  };
}
