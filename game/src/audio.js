// Vaultbreak — generated sound. Every effect is a WebAudio oscillator:
// no audio files, no network, nothing to load. The context is created
// lazily on the first user gesture (browsers require it), and every call
// is a no-op until then, so headless screenshot runs stay silent and
// error-free.

export function makeAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    sirenTimer: null,
    sirenOsc: null,
    sirenGain: null,
  };
  return audio;
}

// Create (or resume) the context. Call from a real user gesture.
export function ensureAudio(audio) {
  try {
    if (!audio.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = audio.muted ? 0 : 0.5;
      audio.master.connect(audio.ctx.destination);
    }
    if (audio.ctx.state === 'suspended') void audio.ctx.resume();
    return true;
  } catch (err) {
    return false;
  }
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master && audio.ctx) {
    audio.master.gain.setTargetAtTime(muted ? 0 : 0.5, audio.ctx.currentTime, 0.02);
  }
  if (muted) stopSiren(audio);
}

function tone(audio, freq, dur, type, vol, delay, slideTo) {
  if (!audio.ctx || !audio.master || audio.muted) return;
  try {
    const t0 = audio.ctx.currentTime + (delay || 0);
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.25, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch (err) {
    // A failed blip must never break the game loop.
  }
}

// Short UI tick (starting a run, pressing a key that does something).
export function playTick(audio) {
  tone(audio, 660, 0.07, 'square', 0.12);
}

// Loot pickup: two rising notes.
export function playPickup(audio) {
  tone(audio, 880, 0.12, 'sine', 0.3);
  tone(audio, 1318, 0.18, 'sine', 0.3, 0.09);
}

// Last stash taken: the van unlocks — a little major arpeggio.
export function playUnlock(audio) {
  tone(audio, 523, 0.12, 'triangle', 0.3);
  tone(audio, 659, 0.12, 'triangle', 0.3, 0.1);
  tone(audio, 784, 0.22, 'triangle', 0.32, 0.2);
}

// Caught: a low falling buzz.
export function playCaught(audio) {
  tone(audio, 220, 0.35, 'sawtooth', 0.25, 0, 90);
}

// Win: a bright four-note climb.
export function playWin(audio) {
  tone(audio, 523, 0.14, 'triangle', 0.3);
  tone(audio, 659, 0.14, 'triangle', 0.3, 0.12);
  tone(audio, 784, 0.14, 'triangle', 0.3, 0.24);
  tone(audio, 1046, 0.3, 'triangle', 0.32, 0.36);
}

// Lose: three descending notes.
export function playLose(audio) {
  tone(audio, 392, 0.16, 'triangle', 0.25);
  tone(audio, 330, 0.16, 'triangle', 0.25, 0.16);
  tone(audio, 262, 0.3, 'triangle', 0.25, 0.32);
}

// Two-tone siren while the alarm is up. A single oscillator whose
// frequency flips between 660 and 880 Hz every 0.4 seconds.
export function startSiren(audio) {
  if (!audio.ctx || audio.sirenTimer) return;
  try {
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 660;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start();
    let high = false;
    audio.sirenTimer = window.setInterval(() => {
      try {
        high = !high;
        osc.frequency.setValueAtTime(high ? 880 : 660, audio.ctx.currentTime);
      } catch (err) {
        stopSiren(audio);
      }
    }, 400);
    audio.sirenOsc = osc;
    audio.sirenGain = gain;
  } catch (err) {
    stopSiren(audio);
  }
}

export function stopSiren(audio) {
  if (audio.sirenTimer) {
    window.clearInterval(audio.sirenTimer);
    audio.sirenTimer = null;
  }
  if (audio.sirenOsc) {
    try {
      audio.sirenOsc.stop();
    } catch (err) {
      // Already stopped: nothing to do.
    }
    audio.sirenOsc = null;
    audio.sirenGain = null;
  }
}
