// Small procedural sound engine built on the Web Audio API.
// Everything here is synthesized (no audio files to load), and nothing makes
// a sound until unlockAudio() runs from a real user gesture (browsers block
// audio until then).

let ctx = null;
let masterGain = null;
let noiseBuffer = null;

function ensureContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.55;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

export function unlockAudio() {
  const c = ensureContext();
  if (c.state === "suspended") c.resume();
}

function getNoiseBuffer() {
  const c = ensureContext();
  if (noiseBuffer) return noiseBuffer;

  const length = c.sampleRate; // 1 second of noise, reused for every burst
  noiseBuffer = c.createBuffer(1, length, c.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

  return noiseBuffer;
}

// ---------------------------------------------------------------------------
// Continuous per-car engine hum. One instance is kept alive per player and
// pitched/gained every frame according to speed.
// ---------------------------------------------------------------------------
export class EngineSound {
  constructor(pan = 0) {
    const c = ensureContext();

    this.osc = c.createOscillator();
    this.osc.type = "sawtooth";
    this.osc.frequency.value = 55;

    this.sub = c.createOscillator();
    this.sub.type = "square";
    this.sub.frequency.value = 28;

    this.filter = c.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 500;

    this.gain = c.createGain();
    this.gain.gain.value = 0.0001;

    this.osc.connect(this.filter);
    this.sub.connect(this.filter);
    this.filter.connect(this.gain);

    if (c.createStereoPanner) {
      this.panner = c.createStereoPanner();
      this.panner.pan.value = pan;
      this.gain.connect(this.panner);
      this.panner.connect(masterGain);
    } else {
      this.gain.connect(masterGain);
    }

    this.osc.start();
    this.sub.start();
  }

  // speedRatio: 0 (idle) .. ~1.5 (top speed with nitro)
  update(speedRatio, nitroActive) {
    const c = ensureContext();
    const now = c.currentTime;
    const s = Math.min(1.5, Math.max(0, speedRatio));

    const freq = 55 + s * 190 + (nitroActive ? 45 : 0);
    const cutoff = 350 + s * 2600 + (nitroActive ? 900 : 0);
    const vol = 0.05 + s * 0.16;

    this.osc.frequency.setTargetAtTime(freq, now, 0.09);
    this.sub.frequency.setTargetAtTime(freq * 0.5, now, 0.09);
    this.filter.frequency.setTargetAtTime(cutoff, now, 0.12);
    this.gain.gain.setTargetAtTime(vol, now, 0.12);
  }

  dispose() {
    try {
      this.osc.stop();
      this.sub.stop();
    } catch (e) {
      /* already stopped */
    }
  }
}

// ---------------------------------------------------------------------------
// One-shot effects
// ---------------------------------------------------------------------------
export function playImpact(strength = 1) {
  const c = ensureContext();
  const now = c.currentTime;
  const amount = Math.min(1, Math.max(0.1, strength));

  const src = c.createBufferSource();
  src.buffer = getNoiseBuffer();

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1400, now);
  filter.frequency.exponentialRampToValueAtTime(90, now + 0.28);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.15 + 0.35 * amount, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  src.start(now);
  src.stop(now + 0.35);
}

export function playNitro() {
  const c = ensureContext();
  const now = c.currentTime;

  const src = c.createBufferSource();
  src.buffer = getNoiseBuffer();

  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(350, now);
  filter.frequency.exponentialRampToValueAtTime(3200, now + 0.4);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.45, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  src.start(now);
  src.stop(now + 0.55);
}

function beep(freq, duration, when = 0, volume = 0.3) {
  const c = ensureContext();
  const now = c.currentTime + when;

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(now);
  osc.stop(now + duration + 0.03);
}

export function playCountdownBeep() {
  beep(720, 0.14);
}

export function playGoBeep() {
  beep(1180, 0.32, 0, 0.35);
}

export function playFanfare() {
  [660, 880, 990, 1320].forEach((freq, i) => beep(freq, 0.24, i * 0.12, 0.3));
}
