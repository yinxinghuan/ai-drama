/**
 * Lightweight sound effects using Web Audio API — no external files needed.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function play(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.08) {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  } catch {
    // Audio not available — silent fallback
  }
}

/** Soft tap — for general buttons */
export function sfxTap() {
  play(800, 0.08, 'sine', 0.06);
}

/** Confirm / CTA — slightly richer */
export function sfxConfirm() {
  play(600, 0.06, 'sine', 0.05);
  setTimeout(() => play(900, 0.1, 'sine', 0.05), 50);
}

/** Navigation — subtle click */
export function sfxNav() {
  play(1200, 0.04, 'sine', 0.04);
}

/** Error / delete — lower tone */
export function sfxWarn() {
  play(300, 0.12, 'triangle', 0.06);
}

/** Success — ascending chirp */
export function sfxSuccess() {
  play(700, 0.06, 'sine', 0.05);
  setTimeout(() => play(1050, 0.1, 'sine', 0.06), 60);
}
