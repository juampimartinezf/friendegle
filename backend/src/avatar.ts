import { randomBytes } from 'node:crypto';

// Avatares: el cliente genera el dibujo (DiceBear) a partir de una configuración pequeña.
// Aquí solo se valida esa configuración: claves conocidas y valores alfanuméricos cortos.
// Nunca se aceptan URLs ni SVG arbitrarios (evita tracking pixels y contenido inyectado).

const SHAPE_KEYS = ['top', 'eyes', 'eyebrows', 'mouth', 'facialHair', 'accessories', 'clothing'];
const COLOR_KEYS = ['hairColor', 'skinColor', 'clothesColor', 'backgroundColor'];
const PROBABILITY_KEYS = ['topProbability', 'facialHairProbability', 'accessoriesProbability'];

export function isValidAvatar(value: string): boolean {
  if (/^preset:[a-z]{2,20}$/.test(value)) return true; // formato antiguo (emoji)
  if (!value.startsWith('dicebear:') || value.length > 600) return false;
  let cfg: unknown;
  try {
    cfg = JSON.parse(value.slice(9));
  } catch {
    return false;
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return false;
  const entries = Object.entries(cfg as Record<string, unknown>);
  if (!entries.some(([k]) => k === 'seed')) return false;
  return entries.every(([k, v]) => {
    if (k === 'seed') return typeof v === 'string' && /^[a-zA-Z0-9_]{1,40}$/.test(v);
    if (SHAPE_KEYS.includes(k)) return typeof v === 'string' && /^[a-zA-Z0-9]{1,30}$/.test(v);
    if (COLOR_KEYS.includes(k)) return typeof v === 'string' && /^[0-9a-fA-F]{6}$/.test(v);
    if (PROBABILITY_KEYS.includes(k)) return v === 0 || v === 100;
    return false;
  });
}

/** Avatar inicial de cada cuenta: aleatorio (distinto para cada una) y editable después. */
export const randomAvatar = () => `dicebear:${JSON.stringify({ seed: randomBytes(6).toString('hex') })}`;

// Autocomprobación: npx tsx src/avatar.ts
if (process.argv[1]?.endsWith('avatar.ts')) {
  const ok = (c: boolean, m: string) => {
    console.log(c ? 'ok  ' : 'FAIL', m);
    if (!c) process.exitCode = 1;
  };
  ok(isValidAvatar(randomAvatar()), 'avatar aleatorio válido');
  ok(isValidAvatar('preset:fox'), 'formato antiguo válido');
  ok(isValidAvatar('dicebear:{"seed":"abc","top":"shortCurly","hairColor":"2c1b18","topProbability":100}'), 'configuración completa válida');
  ok(!isValidAvatar('https://evil.example/pixel.png'), 'rechaza URLs');
  ok(!isValidAvatar('dicebear:{"seed":"a","top":"<script>"}'), 'rechaza valores con símbolos');
  ok(!isValidAvatar('dicebear:{"seed":"a","hairColor":"red"}'), 'rechaza colores no hex');
  ok(!isValidAvatar('dicebear:{"seed":"a","onload":"x"}'), 'rechaza claves desconocidas');
  ok(!isValidAvatar('dicebear:{"top":"hat"}'), 'exige seed');
  ok(!isValidAvatar('dicebear:{"seed":"a","topProbability":50}'), 'probabilidad solo 0 o 100');
  ok(!isValidAvatar('dicebear:' + '{"seed":"' + 'a'.repeat(700) + '"}'), 'rechaza tamaños excesivos');
}
