// ============================================================
// ZERO GRAVITY - AUDIO SYSTEM
// ============================================================


// ============================================================
// GLOBAL AUDIO STATE
// ============================================================

let audioContext = null;

let masterGain = null;
let engineBus = null;
let sfxBus = null;
let ambienceBus = null;

let pauseRequested = false;
let lastImpactTime = -Infinity;

const activeEngines = new Set();
const audioBuffers = new Map();
const failedBuffers = new Set();

const MASTER_VOLUME = 0.88;


// ============================================================
// AUDIO FILES
// ============================================================

const AUDIO_FILES = {
  wind: "/audio/vehicle/wind_loop.ogg",
  nitroStart: "/audio/vehicle/nitro_start.wav",
  brake: "/audio/vehicle/brake_loop.ogg",
  impact1: "/audio/impact/impact_01.wav",
};


// ============================================================
// HELPERS
// ============================================================

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}


// ============================================================
// AUDIO CONTEXT
// ============================================================

function ensureAudio() {
  if (audioContext) {
    return audioContext;
  }

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  audioContext = new AudioContextClass();

  masterGain = audioContext.createGain();
  masterGain.gain.value = MASTER_VOLUME;

  engineBus = audioContext.createGain();
  engineBus.gain.value = 0.88;

  sfxBus = audioContext.createGain();
  sfxBus.gain.value = 0.96;

  ambienceBus = audioContext.createGain();
  ambienceBus.gain.value = 0.74;

  engineBus.connect(masterGain);
  sfxBus.connect(masterGain);
  ambienceBus.connect(masterGain);

  masterGain.connect(audioContext.destination);

  return audioContext;
}


// ============================================================
// STEREO PANNER
// ============================================================

function createPanner(pan = 0) {
  const ctx = ensureAudio();

  if (ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = clamp(pan, -1, 1);
    return panner;
  }

  return ctx.createGain();
}


// ============================================================
// LOAD AUDIO BUFFER
// ============================================================

async function loadBuffer(key) {
  if (audioBuffers.has(key)) {
    return audioBuffers.get(key);
  }

  if (failedBuffers.has(key)) {
    return null;
  }

  const path = AUDIO_FILES[key];

  if (!path) {
    return null;
  }

  try {
    const ctx = ensureAudio();
    const response = await fetch(path);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);

    audioBuffers.set(key, buffer);

    return buffer;
  } catch (error) {
    failedBuffers.add(key);

    console.warn(
      `[Audio] Failed to load ${path}. Using fallback.`,
      error
    );

    return null;
  }
}


// ============================================================
// PRELOAD REAL AUDIO
// ============================================================

export function preloadAudioAssets() {
  ensureAudio();

  Object.keys(AUDIO_FILES).forEach((key) => {
    loadBuffer(key);
  });
}


// ============================================================
// WHITE NOISE BUFFER
// ============================================================

function createNoiseBuffer(duration = 1) {
  const ctx = ensureAudio();

  const length = Math.max(
    1,
    Math.floor(ctx.sampleRate * duration)
  );

  const buffer = ctx.createBuffer(
    1,
    length,
    ctx.sampleRate
  );

  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
}


// ============================================================
// PLAY REAL SAMPLE
// ============================================================

function playLoadedSample(
  key,
  {
    gain = 1,
    pan = 0,
    rate = 1,
    bus = null,
  } = {}
) {
  const buffer = audioBuffers.get(key);

  if (
    !buffer ||
    !audioContext ||
    audioContext.state !== "running" ||
    pauseRequested
  ) {
    return false;
  }

  const source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();
  const panner = createPanner(pan);

  source.buffer = buffer;
  source.playbackRate.value = rate;
  gainNode.gain.value = gain;

  source.connect(gainNode);
  gainNode.connect(panner);
  panner.connect(bus || sfxBus);

  source.start();

  return true;
}


// ============================================================
// PROCEDURAL TONE
// ============================================================

function playTone({
  frequency = 440,
  endFrequency = frequency,
  duration = 0.12,
  gain = 0.05,
  type = "sine",
  pan = 0,
  delay = 0,
} = {}) {
  const ctx = ensureAudio();

  if (ctx.state !== "running" || pauseRequested) {
    return;
  }

  const startTime = ctx.currentTime + delay;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const panner = createPanner(pan);

  oscillator.type = type;

  oscillator.frequency.setValueAtTime(
    Math.max(1, frequency),
    startTime
  );

  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(1, endFrequency),
    startTime + duration
  );

  gainNode.gain.setValueAtTime(
    0.0001,
    startTime
  );

  gainNode.gain.exponentialRampToValueAtTime(
    Math.max(0.0002, gain),
    startTime + 0.01
  );

  gainNode.gain.exponentialRampToValueAtTime(
    0.0001,
    startTime + duration
  );

  oscillator.connect(gainNode);
  gainNode.connect(panner);
  panner.connect(sfxBus);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}


// ============================================================
// PROCEDURAL NOISE BURST
// ============================================================

function playNoiseBurst({
  duration = 0.15,
  gain = 0.08,
  frequency = 800,
  filterType = "bandpass",
  q = 0.7,
  pan = 0,
} = {}) {
  const ctx = ensureAudio();

  if (ctx.state !== "running" || pauseRequested) {
    return;
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gainNode = ctx.createGain();
  const panner = createPanner(pan);

  source.buffer = createNoiseBuffer(duration);

  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = q;

  const now = ctx.currentTime;

  gainNode.gain.setValueAtTime(
    Math.max(gain, 0.0001),
    now
  );

  gainNode.gain.exponentialRampToValueAtTime(
    0.0001,
    now + duration
  );

  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(panner);
  panner.connect(sfxBus);

  source.start(now);
  source.stop(now + duration + 0.03);
}


// ============================================================
// UNLOCK AUDIO
// ============================================================

export async function unlockAudio() {
  const ctx = ensureAudio();

  pauseRequested = false;

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  masterGain.gain.value = MASTER_VOLUME;

  preloadAudioAssets();
}


// ============================================================
// PAUSE ALL AUDIO
// ============================================================

export async function pauseAllAudio() {
  if (
    !audioContext ||
    audioContext.state !== "running"
  ) {
    return;
  }

  pauseRequested = true;

  const now = audioContext.currentTime;

  masterGain.gain.cancelScheduledValues(now);

  masterGain.gain.setValueAtTime(
    Math.max(masterGain.gain.value, 0.0001),
    now
  );

  masterGain.gain.linearRampToValueAtTime(
    0.0001,
    now + 0.06
  );

  await new Promise((resolve) => {
    setTimeout(resolve, 70);
  });

  if (
    pauseRequested &&
    audioContext &&
    audioContext.state === "running"
  ) {
    await audioContext.suspend();
  }
}


// ============================================================
// RESUME ALL AUDIO
// ============================================================

export async function resumeAllAudio() {
  const ctx = ensureAudio();

  pauseRequested = false;

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const now = ctx.currentTime;

  masterGain.gain.cancelScheduledValues(now);

  masterGain.gain.setValueAtTime(
    0.0001,
    now
  );

  masterGain.gain.linearRampToValueAtTime(
    MASTER_VOLUME,
    now + 0.12
  );
}


// ============================================================
// STOP EVERYTHING
// ============================================================

export function stopAllAudio() {
  pauseRequested = false;

  activeEngines.forEach((engine) => {
    engine.stop();
  });

  activeEngines.clear();

  if (
    audioContext &&
    audioContext.state !== "closed"
  ) {
    audioContext.close().catch(() => {});
  }

  audioContext = null;
  masterGain = null;
  engineBus = null;
  sfxBus = null;
  ambienceBus = null;

  audioBuffers.clear();
  failedBuffers.clear();
}


// ============================================================
// MASTER VOLUME
// ============================================================

export function setMasterVolume(volume) {
  const ctx = ensureAudio();
  const value = clamp(volume, 0, 1);

  masterGain.gain.setTargetAtTime(
    value,
    ctx.currentTime,
    0.04
  );
}


// ============================================================
// ENGINE SOUND
// ============================================================

export class EngineSound {
  constructor(pan = 0) {
    this.ctx = ensureAudio();
    this.pan = pan;
    this.stopped = false;

    this.output = this.ctx.createGain();
    this.output.gain.value = 0.85;

    this.panner = createPanner(pan);

    this.output.connect(this.panner);
    this.panner.connect(engineBus);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 900;
    this.engineFilter.Q.value = 0.7;
    this.engineFilter.connect(this.output);

    this.lowOsc = this.ctx.createOscillator();
    this.lowOsc.type = "sawtooth";

    this.lowGain = this.ctx.createGain();
    this.lowGain.gain.value = 0.01;

    this.lowOsc.connect(this.lowGain);
    this.lowGain.connect(this.engineFilter);

    this.midOsc = this.ctx.createOscillator();
    this.midOsc.type = "triangle";

    this.midGain = this.ctx.createGain();
    this.midGain.gain.value = 0.002;

    this.midOsc.connect(this.midGain);
    this.midGain.connect(this.engineFilter);

    this.highOsc = this.ctx.createOscillator();
    this.highOsc.type = "sine";

    this.highGain = this.ctx.createGain();
    this.highGain.gain.value = 0.001;

    this.highOsc.connect(this.highGain);
    this.highGain.connect(this.engineFilter);

    this.lowOsc.start();
    this.midOsc.start();
    this.highOsc.start();

    this.windLoop = null;
    this.brakeLoop = null;

    this.setupSampleLoops();

    activeEngines.add(this);

    this.update({
      speedRatio: 0,
      nitroActive: false,
      throttleActive: false,
      brakeActive: false,
    });
  }


  // ==========================================================
  // CREATE REAL LOOP
  // ==========================================================

  async createLoop(key) {
    const buffer = await loadBuffer(key);

    if (!buffer || this.stopped) {
      return null;
    }

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();

    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0;

    source.connect(gain);
    gain.connect(this.output);

    source.start();

    return {
      source,
      gain,
    };
  }


  // ==========================================================
  // LOAD WIND + BRAKE
  // ==========================================================

  async setupSampleLoops() {
    const results = await Promise.all([
      this.createLoop("wind"),
      this.createLoop("brake"),
    ]);

    if (this.stopped) {
      return;
    }

    [
      this.windLoop,
      this.brakeLoop,
    ] = results;
  }


  // ==========================================================
  // SMOOTH LOOP VOLUME
  // ==========================================================

  setLoopGain(loop, value, smoothing = 0.07) {
    if (!loop) {
      return;
    }

    loop.gain.gain.setTargetAtTime(
      Math.max(0, value),
      this.ctx.currentTime,
      smoothing
    );
  }


  // ==========================================================
  // UPDATE ENGINE
  // ==========================================================

  update(state, legacyNitro = false) {
    if (this.stopped) {
      return;
    }

    let speedRatio;
    let nitroActive;
    let throttleActive;
    let brakeActive;

    if (typeof state === "number") {
      speedRatio = state;
      nitroActive = legacyNitro;
      throttleActive = false;
      brakeActive = false;
    } else {
      speedRatio = state?.speedRatio ?? 0;
      nitroActive = !!state?.nitroActive;
      throttleActive = !!state?.throttleActive;
      brakeActive = !!state?.brakeActive;
    }

    const speed = clamp(
      speedRatio,
      0,
      1.6
    );

    const normalSpeed = clamp(
      speed,
      0,
      1
    );

    const throttle = throttleActive ? 1 : 0;
    const nitro = nitroActive ? 1 : 0;

    const now = this.ctx.currentTime;

    const lowFrequency =
      55 +
      speed * 105;

    const midFrequency =
      100 +
      speed * 240;

    const highFrequency =
      190 +
      speed * 510 +
      nitro * 100;

    this.lowOsc.frequency.setTargetAtTime(
      lowFrequency,
      now,
      0.05
    );

    this.midOsc.frequency.setTargetAtTime(
      midFrequency,
      now,
      0.05
    );

    this.highOsc.frequency.setTargetAtTime(
      highFrequency,
      now,
      0.04
    );

    const lowVolume =
      0.012 +
      normalSpeed * 0.018;

    const midVolume =
      0.002 +
      normalSpeed * 0.020 +
      throttle * 0.002;

    const highVolume =
      0.001 +
      normalSpeed * normalSpeed * 0.014 +
      nitro * 0.008;

    this.lowGain.gain.setTargetAtTime(
      lowVolume,
      now,
      0.07
    );

    this.midGain.gain.setTargetAtTime(
      midVolume,
      now,
      0.07
    );

    this.highGain.gain.setTargetAtTime(
      highVolume,
      now,
      0.06
    );

    const filterCutoff =
      600 +
      normalSpeed * 1800 +
      throttle * 300 +
      nitro * 650;

    this.engineFilter.frequency.setTargetAtTime(
      filterCutoff,
      now,
      0.08
    );

    const windAmount =
      normalSpeed * normalSpeed;

    const windVolume =
      windAmount * 0.11 +
      (nitroActive ? 0.055 : 0);

    this.setLoopGain(
      this.windLoop,
      windVolume,
      0.12
    );

    if (this.windLoop) {
      this.windLoop.source.playbackRate.setTargetAtTime(
        0.82 + speed * 0.32,
        now,
        0.12
      );
    }

    const brakingAmount =
      brakeActive && normalSpeed > 0.18
        ? Math.pow(normalSpeed, 1.5)
        : 0;

    this.setLoopGain(
      this.brakeLoop,
      brakingAmount * 0.12,
      0.035
    );

    if (this.brakeLoop) {
      this.brakeLoop.source.playbackRate.setTargetAtTime(
        0.88 + normalSpeed * 0.34,
        now,
        0.055
      );
    }
  }


  // ==========================================================
  // RESET ENGINE
  // ==========================================================

  reset() {
    this.setLoopGain(
      this.windLoop,
      0
    );

    this.setLoopGain(
      this.brakeLoop,
      0
    );

    this.update({
      speedRatio: 0,
      nitroActive: false,
      throttleActive: false,
      brakeActive: false,
    });
  }


  // ==========================================================
  // STOP ENGINE
  // ==========================================================

  stop() {
    if (this.stopped) {
      return;
    }

    this.stopped = true;

    const sources = [
      this.lowOsc,
      this.midOsc,
      this.highOsc,
      this.windLoop?.source,
      this.brakeLoop?.source,
    ];

    sources.forEach((source) => {
      if (!source) {
        return;
      }

      try {
        source.stop();
      } catch {}
    });

    try {
      this.output.disconnect();
    } catch {}

    activeEngines.delete(this);
  }
}


// ============================================================
// NITRO START
// ============================================================

export function playNitro(pan = 0) {
  if (
    playLoadedSample(
      "nitroStart",
      {
        gain: 0.22,
        pan,
      }
    )
  ) {
    return;
  }

  loadBuffer("nitroStart");

  playNoiseBurst({
    duration: 0.30,
    gain: 0.09,
    frequency: 1400,
    filterType: "bandpass",
    q: 0.55,
    pan,
  });

  playTone({
    frequency: 90,
    endFrequency: 260,
    duration: 0.25,
    gain: 0.035,
    type: "sawtooth",
    pan,
  });
}


// ============================================================
// COLLISION / IMPACT
// ============================================================

export function playImpact(strength = 1) {
  const ctx = ensureAudio();

  if (
    ctx.state !== "running" ||
    pauseRequested
  ) {
    return;
  }

  const now = ctx.currentTime;

  if (
    now - lastImpactTime <
    0.09
  ) {
    return;
  }

  lastImpactTime = now;

  const impact = clamp(
    strength,
    0.15,
    1
  );

  const pan = randomBetween(
    -0.22,
    0.22
  );

  const rate = randomBetween(
    0.94,
    1.06
  );

  const played = playLoadedSample(
    "impact1",
    {
      gain:
        0.15 +
        impact * 0.32,

      pan,
      rate,
    }
  );

  if (played) {
    return;
  }

  loadBuffer("impact1");

  playNoiseBurst({
    duration:
      0.08 +
      impact * 0.08,

    gain:
      0.05 +
      impact * 0.10,

    frequency:
      750 -
      impact * 260,

    filterType: "lowpass",
    q: 0.7,
    pan,
  });

  playTone({
    frequency: 95,
    endFrequency: 48,
    duration: 0.13,

    gain:
      0.025 +
      impact * 0.05,

    type: "triangle",
    pan,
  });
}


// ============================================================
// COUNTDOWN
// ============================================================

export function playCountdownBeep() {
  playTone({
    frequency: 520,
    endFrequency: 500,
    duration: 0.11,
    gain: 0.045,
    type: "square",
  });
}


// ============================================================
// GO
// ============================================================

export function playGoBeep() {
  playTone({
    frequency: 760,
    endFrequency: 980,
    duration: 0.20,
    gain: 0.07,
    type: "square",
  });

  playTone({
    frequency: 380,
    endFrequency: 500,
    duration: 0.22,
    gain: 0.022,
    type: "sine",
  });
}


// ============================================================
// LAP COMPLETE
// ============================================================

export function playLap(pan = 0) {
  playTone({
    frequency: 660,
    endFrequency: 660,
    duration: 0.12,
    gain: 0.04,
    type: "sine",
    pan,
  });

  playTone({
    frequency: 880,
    endFrequency: 880,
    duration: 0.15,
    gain: 0.045,
    type: "sine",
    delay: 0.08,
    pan,
  });
}


// ============================================================
// FINAL LAP
// ============================================================

export function playFinalLap(pan = 0) {
  playTone({
    frequency: 620,
    endFrequency: 620,
    duration: 0.10,
    gain: 0.045,
    type: "triangle",
    pan,
  });

  playTone({
    frequency: 820,
    endFrequency: 820,
    duration: 0.12,
    gain: 0.05,
    type: "triangle",
    delay: 0.09,
    pan,
  });

  playTone({
    frequency: 1080,
    endFrequency: 1080,
    duration: 0.24,
    gain: 0.06,
    type: "triangle",
    delay: 0.18,
    pan,
  });
}


// ============================================================
// FINISH FANFARE
// ============================================================

export function playFanfare() {
  playTone({
    frequency: 110,
    endFrequency: 65,
    duration: 0.28,
    gain: 0.07,
    type: "sawtooth",
  });

  const notes = [
    {
      frequency: 440,
      delay: 0.05,
      duration: 0.18,
    },
    {
      frequency: 554,
      delay: 0.16,
      duration: 0.18,
    },
    {
      frequency: 659,
      delay: 0.27,
      duration: 0.20,
    },
    {
      frequency: 880,
      delay: 0.39,
      duration: 0.42,
    },
  ];

  notes.forEach((note, index) => {
    playTone({
      frequency: note.frequency,
      endFrequency: note.frequency,
      duration: note.duration,

      gain:
        index === notes.length - 1
          ? 0.075
          : 0.045,

      type: "triangle",
      delay: note.delay,
    });
  });
}