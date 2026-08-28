/** Ambient bed: the attached Aether track, a live field, or a file you choose. */

import type { Mode, SoundSource } from "./types";

export const AETHER_TRACK = `${import.meta.env.BASE_URL}audio/ethereal.mp3`;

type Voice = {
  pads: number[];
  filter: number;
  q: number;
  noise: number;
  noiseHp: number;
  lfoHz: number;
  lfoDepth: number;
  sparkleHz: number;
  sparkle: number;
  delay: number;
  delay2: number;
  fb: number;
  swell: number;
};

const VOICES: Record<Mode, Voice> = {
  drift: {
    pads: [110, 164.81, 220, 329.63],
    filter: 980,
    q: 0.7,
    noise: 0.028,
    noiseHp: 520,
    lfoHz: 0.06,
    lfoDepth: 280,
    sparkleHz: 1174,
    sparkle: 0.012,
    delay: 0.33,
    delay2: 0.47,
    fb: 0.36,
    swell: 0.1,
  },
  orbit: {
    pads: [146.83, 220, 293.66, 440],
    filter: 1200,
    q: 0.9,
    noise: 0.016,
    noiseHp: 700,
    lfoHz: 0.21,
    lfoDepth: 360,
    sparkleHz: 880,
    sparkle: 0.018,
    delay: 0.22,
    delay2: 0.44,
    fb: 0.4,
    swell: 0.14,
  },
  weave: {
    pads: [130.81, 196, 261.63, 392],
    filter: 1100,
    q: 1.1,
    noise: 0.02,
    noiseHp: 640,
    lfoHz: 0.13,
    lfoDepth: 220,
    sparkleHz: 1568,
    sparkle: 0.02,
    delay: 0.17,
    delay2: 0.29,
    fb: 0.46,
    swell: 0.12,
  },
  ember: {
    pads: [98, 196, 392, 784],
    filter: 1600,
    q: 0.6,
    noise: 0.04,
    noiseHp: 1600,
    lfoHz: 0.09,
    lfoDepth: 500,
    sparkleHz: 2093,
    sparkle: 0.04,
    delay: 0.26,
    delay2: 0.51,
    fb: 0.28,
    swell: 0.08,
  },
  tide: {
    pads: [65.41, 98, 196, 246.94],
    filter: 640,
    q: 0.55,
    noise: 0.034,
    noiseHp: 280,
    lfoHz: 0.045,
    lfoDepth: 180,
    sparkleHz: 523,
    sparkle: 0.01,
    delay: 0.41,
    delay2: 0.63,
    fb: 0.42,
    swell: 0.22,
  },
  figure: {
    pads: [174.61, 220, 261.63, 349.23],
    filter: 1080,
    q: 0.85,
    noise: 0.018,
    noiseHp: 480,
    lfoHz: 0.07,
    lfoDepth: 240,
    sparkleHz: 698,
    sparkle: 0.016,
    delay: 0.3,
    delay2: 0.48,
    fb: 0.38,
    swell: 0.13,
  },
  nerve: {
    pads: [329.63, 493.88, 659.26, 987.77],
    filter: 1900,
    q: 1.3,
    noise: 0.012,
    noiseHp: 1200,
    lfoHz: 0.38,
    lfoDepth: 420,
    sparkleHz: 2637,
    sparkle: 0.028,
    delay: 0.09,
    delay2: 0.18,
    fb: 0.32,
    swell: 0.1,
  },
};

type Tone = {
  ctx: AudioContext;
  master: GainNode;
  synthGain: GainNode;
  fileGain: GainNode;
  filter: BiquadFilterNode;
  pads: OscillatorNode[];
  padGains: GainNode[];
  noise: AudioBufferSourceNode;
  noiseGain: GainNode;
  noiseHp: BiquadFilterNode;
  sparkle: OscillatorNode;
  sparkleGain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  swell: OscillatorNode;
  swellGain: GainNode;
  delay: DelayNode;
  delay2: DelayNode;
  fb: GainNode;
  fb2: GainNode;
};

let tone: Tone | null = null;
let el: HTMLAudioElement | null = null;
let mediaNode: MediaElementAudioSourceNode | null = null;
let customUrl: string | null = null;
let wanted = false;
let volume = 62;
let loop = true;
let source: SoundSource = "aether";
let mode: Mode = "drift";

function masterLevel() {
  if (!wanted) return 0;
  const t = volume / 100;
  return t * t * 0.85;
}

function makeNoise(ctx: AudioContext) {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    data[i] = (b0 + b1 + b2 + w * 0.1) * 0.18;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

function trackUrl() {
  if (source === "custom" && customUrl) return customUrl;
  return AETHER_TRACK;
}

async function ensure(): Promise<Tone | null> {
  if (tone) return tone;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();

  const master = ctx.createGain();
  master.gain.value = 0;
  const synthGain = ctx.createGain();
  synthGain.gain.value = 0;
  const fileGain = ctx.createGain();
  fileGain.gain.value = 0;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 980;
  filter.Q.value = 0.7;

  const delay = ctx.createDelay(1.2);
  delay.delayTime.value = 0.33;
  const delay2 = ctx.createDelay(1.2);
  delay2.delayTime.value = 0.47;
  const fb = ctx.createGain();
  fb.gain.value = 0.36;
  const fb2 = ctx.createGain();
  fb2.gain.value = 0.3;
  const damp = ctx.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 2400;
  const damp2 = ctx.createBiquadFilter();
  damp2.type = "lowpass";
  damp2.frequency.value = 1800;
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  const dry = ctx.createGain();
  dry.gain.value = 0.7;

  filter.connect(dry);
  dry.connect(synthGain);
  filter.connect(damp);
  damp.connect(delay);
  delay.connect(fb);
  fb.connect(damp);
  delay.connect(wet);
  filter.connect(damp2);
  damp2.connect(delay2);
  delay2.connect(fb2);
  fb2.connect(damp2);
  delay2.connect(wet);
  wet.connect(synthGain);
  synthGain.connect(master);
  fileGain.connect(master);
  master.connect(ctx.destination);

  const pads: OscillatorNode[] = [];
  const padGains: GainNode[] = [];
  const types: OscillatorType[] = ["sine", "sine", "triangle", "sine"];
  const levels = [0.11, 0.08, 0.045, 0.035];
  for (let i = 0; i < 4; i++) {
    const osc = ctx.createOscillator();
    osc.type = types[i] ?? "sine";
    osc.frequency.value = 110 * (i + 1);
    osc.detune.value = (i - 1.5) * 6;
    const g = ctx.createGain();
    g.gain.value = levels[i] ?? 0.04;
    osc.connect(g);
    g.connect(filter);
    osc.start();
    pads.push(osc);
    padGains.push(g);
  }

  const noiseHp = ctx.createBiquadFilter();
  noiseHp.type = "highpass";
  noiseHp.frequency.value = 520;
  const noiseBp = ctx.createBiquadFilter();
  noiseBp.type = "bandpass";
  noiseBp.frequency.value = 1400;
  noiseBp.Q.value = 0.5;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;
  const noise = makeNoise(ctx);
  noise.connect(noiseHp);
  noiseHp.connect(noiseBp);
  noiseBp.connect(noiseGain);
  noiseGain.connect(filter);
  noise.start();

  const sparkle = ctx.createOscillator();
  sparkle.type = "sine";
  sparkle.frequency.value = 1174;
  const sparkleGain = ctx.createGain();
  sparkleGain.gain.value = 0;
  sparkle.connect(sparkleGain);
  sparkleGain.connect(filter);
  sparkle.start();

  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.06;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 280;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();

  const swell = ctx.createOscillator();
  swell.type = "sine";
  swell.frequency.value = 0.05;
  const swellGain = ctx.createGain();
  swellGain.gain.value = 0;
  swell.connect(swellGain);
  swellGain.connect(synthGain.gain);
  swell.start();

  tone = {
    ctx,
    master,
    synthGain,
    fileGain,
    filter,
    pads,
    padGains,
    noise,
    noiseGain,
    noiseHp,
    sparkle,
    sparkleGain,
    lfo,
    lfoGain,
    swell,
    swellGain,
    delay,
    delay2,
    fb,
    fb2,
  };
  applyVoice(tone, VOICES[mode], 0.05);
  return tone;
}

function applyVoice(t: Tone, v: Voice, tau: number) {
  const now = t.ctx.currentTime;
  for (let i = 0; i < t.pads.length; i++) {
    const hz = v.pads[i] ?? v.pads[v.pads.length - 1] ?? 220;
    t.pads[i]?.frequency.setTargetAtTime(hz, now, tau);
  }
  t.filter.frequency.setTargetAtTime(v.filter, now, tau);
  t.filter.Q.setTargetAtTime(v.q, now, tau);
  t.noiseGain.gain.setTargetAtTime(v.noise, now, tau);
  t.noiseHp.frequency.setTargetAtTime(v.noiseHp, now, tau);
  t.lfo.frequency.setTargetAtTime(v.lfoHz, now, tau);
  t.lfoGain.gain.setTargetAtTime(v.lfoDepth, now, tau);
  t.sparkle.frequency.setTargetAtTime(v.sparkleHz, now, tau);
  t.sparkleGain.gain.setTargetAtTime(v.sparkle, now, tau);
  t.delay.delayTime.setTargetAtTime(v.delay, now, tau);
  t.delay2.delayTime.setTargetAtTime(v.delay2, now, tau);
  t.fb.gain.setTargetAtTime(v.fb, now, tau);
  t.fb2.gain.setTargetAtTime(v.fb * 0.85, now, tau);
  t.swell.frequency.setTargetAtTime(Math.max(0.03, v.lfoHz * 0.6), now, tau);
  t.swellGain.gain.setTargetAtTime(v.swell * 0.12, now, tau);
}

function ensureElement() {
  if (el) return el;
  const audio = new Audio();
  audio.preload = "auto";
  audio.crossOrigin = "anonymous";
  audio.loop = loop;
  audio.addEventListener("ended", () => {
    if (!loop && wanted && source !== "field") {
      audio.currentTime = 0;
    }
  });
  el = audio;
  return audio;
}

async function wireFile(t: Tone) {
  const audio = ensureElement();
  if (!mediaNode) {
    mediaNode = t.ctx.createMediaElementSource(audio);
    mediaNode.connect(t.fileGain);
  }
  const next = trackUrl();
  if (audio.getAttribute("data-src") !== next) {
    audio.src = next;
    audio.setAttribute("data-src", next);
  }
  audio.loop = loop;
}

function routeBuses(t: Tone) {
  const now = t.ctx.currentTime;
  const fileOn = source !== "field";
  t.fileGain.gain.setTargetAtTime(fileOn ? 1 : 0, now, 0.08);
  t.synthGain.gain.setTargetAtTime(fileOn ? 0 : 1, now, 0.12);
  t.swellGain.gain.setTargetAtTime(fileOn ? 0 : VOICES[mode].swell * 0.12, now, 0.12);
}

export function setSoundEnabled(on: boolean) {
  wanted = on;
  if (on) void enableSound();
  else disableSound();
}

export function setSoundVolume(n: number) {
  volume = Math.max(0, Math.min(100, n));
  if (!tone) return;
  const now = tone.ctx.currentTime;
  tone.master.gain.setTargetAtTime(masterLevel(), now, 0.06);
}

export function setSoundLoop(on: boolean) {
  loop = on;
  if (el) el.loop = on;
  if (on && wanted && source !== "field" && el && el.paused) void el.play().catch(() => {});
}

export function setSoundSource(next: SoundSource) {
  source = next;
  if (!wanted) return;
  void enableSound();
}

export async function loadCustomSound(file: File) {
  if (customUrl) URL.revokeObjectURL(customUrl);
  customUrl = URL.createObjectURL(file);
  source = "custom";
  if (wanted) await enableSound();
}

export async function enableSound() {
  wanted = true;
  const t = await ensure();
  if (!t) return;
  if (t.ctx.state === "suspended") {
    try {
      await t.ctx.resume();
    } catch {
      return;
    }
  }
  if (!wanted) return;
  routeBuses(t);
  applyVoice(t, VOICES[mode], 0.4);
  const now = t.ctx.currentTime;
  t.master.gain.cancelScheduledValues(now);
  t.master.gain.setTargetAtTime(masterLevel(), now, 0.25);
  if (source === "field") {
    el?.pause();
    return;
  }
  await wireFile(t);
  if (!el) return;
  try {
    await el.play();
  } catch {
    /* wait for a later gesture */
  }
}

export function disableSound() {
  wanted = false;
  el?.pause();
  if (!tone) return;
  const { ctx, master, swellGain } = tone;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(0, now, 0.12);
  swellGain.gain.setTargetAtTime(0, now, 0.08);
}

export async function resumeSound() {
  if (!wanted) return;
  await enableSound();
}

export function setSoundMode(next: Mode) {
  mode = next;
  if (!tone || !wanted || source !== "field") return;
  applyVoice(tone, VOICES[next], 0.7);
}

export function pulseSound(energy: number, dt: number) {
  if (!wanted || !tone) return;
  const { ctx, master, filter, sparkleGain, fileGain } = tone;
  const now = ctx.currentTime;
  const tau = Math.max(0.05, dt);
  master.gain.setTargetAtTime(masterLevel() * (1 + Math.min(0.12, energy * 0.1)), now, tau);
  if (source !== "field") {
    fileGain.gain.setTargetAtTime(1 + Math.min(0.08, energy * 0.06), now, 0.14);
    return;
  }
  const v = VOICES[mode];
  filter.frequency.setTargetAtTime(v.filter + energy * 720, now, 0.14);
  sparkleGain.gain.setTargetAtTime(v.sparkle + energy * 0.04, now, 0.1);
}

export function chimeSound(kind: "figure" | "nerve" = "figure") {
  if (!wanted || !tone || source !== "field") return;
  const { ctx, filter } = tone;
  const now = ctx.currentTime;
  const a = ctx.createOscillator();
  const b = ctx.createOscillator();
  const g = ctx.createGain();
  a.type = "sine";
  b.type = "sine";
  a.frequency.value = kind === "nerve" ? 1318.5 : 698.46;
  b.frequency.value = kind === "nerve" ? 1975.5 : 1046.5;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.07, now + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
  a.connect(g);
  b.connect(g);
  g.connect(filter);
  a.start(now);
  b.start(now);
  a.stop(now + 2.5);
  b.stop(now + 2.5);
}

export function disposeSound() {
  el?.pause();
  el = null;
  mediaNode = null;
  if (customUrl) {
    URL.revokeObjectURL(customUrl);
    customUrl = null;
  }
  if (!tone) return;
  try {
    for (const osc of tone.pads) osc.stop();
    tone.sparkle.stop();
    tone.lfo.stop();
    tone.swell.stop();
    tone.noise.stop();
    void tone.ctx.close();
  } catch {
    /* already closed */
  }
  tone = null;
}
