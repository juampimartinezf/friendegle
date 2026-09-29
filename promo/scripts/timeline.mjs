// Mide la duración de cada frase narrada y arma la línea de tiempo (src/timeline.json).
// Cada escena dura lo mínimo indicado o más si su frase no entra.
import { readFileSync, writeFileSync } from 'node:fs';

const FPS = 30;
const wavSeconds = (file) => {
  const b = readFileSync(new URL(`../public/${file}`, import.meta.url));
  let i = 12;
  let rate = 0, bytesPerSec = 0;
  while (i < b.length) {
    const id = b.toString('ascii', i, i + 4);
    const size = b.readUInt32LE(i + 4);
    if (id === 'fmt ') bytesPerSec = b.readUInt32LE(i + 16), rate = b.readUInt32LE(i + 12);
    if (id === 'data') return size / bytesPerSec;
    i += 8 + size + (size % 2);
  }
  throw new Error(`WAV sin datos: ${file} (${rate})`);
};

// escena → [frase, fotogramas mínimos, fotograma en que empieza la voz]
const plan = [
  ['hook', 'v1', 135, 12],
  ['clock', 'v2', 165, 8],
  ['sign', 'v3', 195, 20],
  ['phone', 'v4', 170, 8],
  ['winner', 'v5', 120, 14],
  ['cta', 'v6', 120, 6],
];

let from = 0;
const scenes = plan.map(([id, voice, min, voiceAt]) => {
  const voiceFrames = Math.ceil(wavSeconds(`voice/${voice}.wav`) * FPS);
  const duration = Math.max(min, voiceAt + voiceFrames + 20);
  const scene = { id, from, duration, voice: `voice/${voice}.wav`, voiceAt, voiceFrames };
  from += duration;
  return scene;
});
writeFileSync(new URL('../src/timeline.json', import.meta.url), JSON.stringify({ fps: FPS, total: from, scenes }, null, 2) + '\n');
console.log(scenes.map((s) => `${s.id}: ${(s.duration / FPS).toFixed(1)} s (voz ${(s.voiceFrames / FPS).toFixed(1)} s)`).join('\n'));
console.log(`total: ${(from / FPS).toFixed(1)} s`);
