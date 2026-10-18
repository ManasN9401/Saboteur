// The desk clock's sounds, synthesised with Web Audio (no files): the alarm bell, and a quiet tick.
// Browsers only allow sound after a click or key press, so `unlockSound` runs from the Start button.
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

export function unlockSound() {
  const a = audio();
  if (a && a.state === "suspended") a.resume().catch(() => {});
}

/** One strike of the bell: a few inharmonic partials, a sharp attack and a ringing decay. */
function strike(a: AudioContext, at: number, gain: number) {
  const out = a.createGain();
  out.gain.setValueAtTime(0, at);
  out.gain.linearRampToValueAtTime(gain, at + 0.003);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
  out.connect(a.destination);
  for (const [f, g] of [
    [1180, 1],
    [2950, 0.5],
    [4230, 0.28],
    [6110, 0.12],
  ]) {
    const o = a.createOscillator();
    const og = a.createGain();
    o.frequency.value = f;
    og.gain.value = g;
    o.connect(og).connect(out);
    o.start(at);
    o.stop(at + 0.95);
  }
}

/** An old alarm clock going off: the hammer rattling between two bells, in three short bursts. */
export function ringBell() {
  const a = audio();
  if (!a || a.state !== "running") return;
  const t0 = a.currentTime + 0.02;
  for (let burst = 0; burst < 3; burst++) {
    for (let i = 0; i < 14; i++) strike(a, t0 + burst * 0.9 + i * 0.045, 0.05 * (i % 2 ? 0.75 : 1));
  }
}

/** A soft mechanical tick. */
export function tick() {
  const a = audio();
  if (!a || a.state !== "running") return;
  const at = a.currentTime;
  const len = Math.floor(a.sampleRate * 0.012);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len / 6));
  const src = a.createBufferSource();
  const band = a.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 3200;
  band.Q.value = 4;
  const g = a.createGain();
  g.gain.value = 0.18;
  src.buffer = buf;
  src.connect(band).connect(g).connect(a.destination);
  src.start(at);
}
