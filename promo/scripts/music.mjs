// Música de fondo y efectos de sonido sintetizados por código: 100 % propios, sin derechos de terceros.
// Genera public/music.wav (128 BPM, ~32 s) y public/sfx/*.wav.
import { mkdirSync, writeFileSync } from 'node:fs';

const SR = 44100;
const out = new URL('../public/', import.meta.url);
mkdirSync(new URL('sfx/', out), { recursive: true });

function writeWav(name, samples) {
  const data = Buffer.alloc(samples.length * 2);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const gain = peak > 0.98 ? 0.98 / peak : 1; // normaliza solo si satura
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * gain)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(new URL(name, out), Buffer.concat([h, data]));
  console.log(`audio ${name} (${(samples.length / SR).toFixed(1)} s)`);
}

// Ruido determinista (mismo resultado en cada ejecución)
let seed = 12345;
const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5));

// ---------------------------------------------------------------- música
const BPM = 128;
const beat = 60 / BPM;
const LEN = 32;
const music = new Float32Array(LEN * SR);
const add = (t0, arr, gain = 1) => {
  const i0 = Math.round(t0 * SR);
  for (let i = 0; i < arr.length && i0 + i < music.length; i++) music[i0 + i] += arr[i] * gain;
};

const kick = Float32Array.from({ length: 0.35 * SR }, (_, i) => {
  const t = i / SR;
  const f = 45 + 110 * Math.exp(-t * 28);
  return Math.sin(2 * Math.PI * f * t - 0) * Math.exp(-t * 9) * 0.9;
});
const hat = Float32Array.from({ length: 0.06 * SR }, (_, i) => {
  // ruido "brillante": diferencia de muestras = paso alto barato
  return (noise() - noise() * 0.6) * Math.exp((-i / SR) * 70) * 0.18;
});
const clap = Float32Array.from({ length: 0.2 * SR }, (_, i) => {
  const t = i / SR;
  const bursts = t < 0.03 ? (Math.floor(t * 300) % 2 ? 1 : 0.4) : 1;
  return noise() * Math.exp(-t * 22) * 0.35 * bursts;
});
function synth(freqs, dur, gain, bright = 1) {
  // "supersaw" simple: varias sierras desafinadas + filtro paso bajo de un polo
  const n = Math.round(dur * SR);
  const outArr = new Float32Array(n);
  const detune = [-0.012, -0.004, 0.004, 0.012];
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    for (const f of freqs) for (const d of detune) s += saw(f * (1 + d) * t + d * 7);
    s /= freqs.length * detune.length;
    const cutoff = (0.08 + 0.25 * bright * Math.exp(-t * 6));
    lp += cutoff * (s - lp);
    const env = Math.min(1, t * 200) * Math.exp(-t * 3.2);
    outArr[i] = lp * env * gain;
  }
  return outArr;
}
const bassNote = (f, dur) =>
  Float32Array.from({ length: Math.round(dur * SR) }, (_, i) => {
    const t = i / SR;
    return (Math.sin(2 * Math.PI * f * t) * 0.8 + saw(f * t) * 0.25) * Math.min(1, t * 300) * Math.exp(-t * 5) * 0.55;
  });

// La menor – Fa – Do – Sol (energético y alegre)
const prog = [
  [57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62],
];
const bassRoots = [45, 41, 48, 43];
const bars = Math.ceil(LEN / (beat * 4));
for (let bar = 0; bar < bars; bar++) {
  const t0 = bar * beat * 4;
  const chord = prog[bar % 4].map((m) => mtof(m + 12));
  const intro = bar < 2; // 2 compases de intro sin bombo
  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * beat;
    if (!intro) add(tb, kick);
    add(tb + beat / 2, hat, intro ? 0.6 : 1);
    if (!intro && b % 2 === 1) add(tb, clap);
    add(tb + beat / 2, bassNote(mtof(bassRoots[bar % 4]), beat / 2), intro ? 0 : 1);
    add(tb + beat * 0.75, bassNote(mtof(bassRoots[bar % 4] + 12), beat / 4), intro ? 0 : 0.6);
    // acordes en contratiempo (stabs)
    add(tb + beat / 2, synth(chord, beat * 0.45, 0.28, intro ? 0.5 : 1));
  }
}
// "Pump" de sidechain: baja todo salvo el bombo en cada tiempo (sensación de energía)
for (let i = 0; i < music.length; i++) {
  const t = i / SR;
  const inBeat = (t % beat) / beat;
  if (t >= 2 * 4 * beat) music[i] *= 0.55 + 0.45 * Math.min(1, inBeat * 3.5);
}
writeWav('music.wav', Array.from(music, (s) => Math.tanh(s * 1.2) * 0.8));

// ---------------------------------------------------------------- efectos
const make = (dur, fn) => Array.from({ length: Math.round(dur * SR) }, (_, i) => fn(i / SR));

// Whoosh: ruido filtrado con barrido
{
  let lp = 0;
  writeWav('sfx/whoosh.wav', make(0.5, (t) => {
    const c = 0.02 + 0.3 * Math.sin((Math.PI * t) / 0.5);
    lp += c * (noise() - lp);
    return lp * Math.sin((Math.PI * t) / 0.5) * 1.2;
  }));
}
// Pop: burbuja que sube
writeWav('sfx/pop.wav', make(0.12, (t) => Math.sin(2 * Math.PI * (300 + 2500 * t) * t) * Math.exp(-t * 35) * 0.8));
// Caja registradora "cha-ching": golpe metálico + dos campanas
writeWav('sfx/cash.wav', make(1.1, (t) => {
  const hit = noise() * Math.exp(-t * 40) * 0.4;
  const bell = (t0, f) => (t < t0 ? 0 : [1, 2.76, 5.4].reduce((s, h, k) => s + Math.sin(2 * Math.PI * f * h * (t - t0)) / (k + 1), 0) * Math.exp(-(t - t0) * 4) * 0.35);
  return hit + bell(0.08, 1320) + bell(0.2, 1760);
}));
// Tecla (tipeo)
writeWav('sfx/key.wav', make(0.04, (t) => (noise() * 0.5 + Math.sin(2 * Math.PI * 1800 * t)) * Math.exp(-t * 180) * 0.6));
// Tic-tac de reloj
writeWav('sfx/tick.wav', make(0.05, (t) => Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 120) * 0.7));
// Ding de mensaje enviado
writeWav('sfx/ding.wav', make(0.6, (t) => (Math.sin(2 * Math.PI * 1568 * t) + 0.5 * Math.sin(2 * Math.PI * 2349 * t)) * Math.exp(-t * 6) * 0.45));
// Subida (riser) antes del ganador
writeWav('sfx/riser.wav', make(1.5, (t) => {
  const f = 200 * 2 ** (t * 2.4);
  return (saw(f * t) * 0.3 + noise() * 0.25 * (t / 1.5)) * (t / 1.5) ** 2 * 0.7;
}));
// ¡Ganador! Fanfarria corta (arpegio mayor) + aplausos de ruido
writeWav('sfx/win.wav', make(2.2, (t) => {
  const notes = [72, 76, 79, 84];
  let s = 0;
  notes.forEach((m, k) => {
    const t0 = k * 0.09;
    if (t >= t0) s += (saw(mtof(m) * (t - t0)) * 0.3 + Math.sin(2 * Math.PI * mtof(m) * (t - t0)) * 0.5) * Math.exp(-(t - t0) * (k === 3 ? 1.6 : 7));
  });
  const claps = noise() * 0.25 * Math.min(1, t * 4) * Math.exp(-Math.max(0, t - 0.6) * 1.5) * (0.6 + 0.4 * Math.abs(Math.sin(t * 60)));
  return s * 0.5 + claps;
}));
