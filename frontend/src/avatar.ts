import { createAvatar } from '@dicebear/core';
import * as avataaars from '@dicebear/avataaars';

/**
 * Avatares personalizables (DiceBear, estilo Avataaars, licencia libre también para uso comercial).
 * Se generan en el navegador: ninguna petición a servicios externos.
 *
 * En la BD se guardan como  "dicebear:{json}"  en users.avatar_url, p. ej.
 *   dicebear:{"seed":"a1b2c3","top":"shortCurly","hairColor":"2c1b18","eyes":"happy"}
 * Lo que no está elegido sale del seed (cada cuenta nace con uno aleatorio distinto).
 * Los antiguos "preset:fox" siguen funcionando (emojis).
 */
export type AvatarConfig = Record<string, string | number>;

const props = avataaars.schema.properties as Record<string, { items?: { enum?: string[] }; default?: unknown }>;
const enumOf = (k: string) => props[k]?.items?.enum ?? [];
const paletteOf = (k: string) => (props[k]?.default as string[]) ?? [];

export interface AvatarCategory {
  key: string;
  label: string;
  kind: 'shape' | 'color';
  options: string[];
  /** Opción "ninguno" que pone esta probabilidad a 0 */
  noneProbability?: string;
}

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  { key: 'top', label: 'Pelo y gorros', kind: 'shape', options: enumOf('top'), noneProbability: 'topProbability' },
  { key: 'hairColor', label: 'Color de pelo', kind: 'color', options: paletteOf('hairColor') },
  { key: 'skinColor', label: 'Piel', kind: 'color', options: paletteOf('skinColor') },
  { key: 'eyes', label: 'Ojos', kind: 'shape', options: enumOf('eyes') },
  { key: 'eyebrows', label: 'Cejas', kind: 'shape', options: enumOf('eyebrows') },
  { key: 'mouth', label: 'Boca', kind: 'shape', options: enumOf('mouth') },
  { key: 'facialHair', label: 'Barba', kind: 'shape', options: enumOf('facialHair'), noneProbability: 'facialHairProbability' },
  { key: 'accessories', label: 'Gafas', kind: 'shape', options: enumOf('accessories'), noneProbability: 'accessoriesProbability' },
  { key: 'clothing', label: 'Ropa', kind: 'shape', options: enumOf('clothing') },
  { key: 'clothesColor', label: 'Color de ropa', kind: 'color', options: paletteOf('clothesColor') },
  {
    key: 'backgroundColor',
    label: 'Fondo',
    kind: 'color',
    options: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'c7f0d8', 'fff1a8', '1976d2'],
  },
];

export const randomSeed = () => Math.random().toString(36).slice(2, 12);

export function parseAvatar(value: string | null | undefined): AvatarConfig | null {
  if (!value?.startsWith('dicebear:')) return null;
  try {
    const cfg = JSON.parse(value.slice(9));
    return cfg && typeof cfg === 'object' ? cfg : null;
  } catch {
    return null;
  }
}

export const serializeAvatar = (cfg: AvatarConfig) => `dicebear:${JSON.stringify(cfg)}`;

const cache = new Map<string, string>();

/** SVG como data URI (permitido por la CSP: img-src 'self' data:). Cacheado por configuración. */
export function avatarDataUri(cfg: AvatarConfig): string {
  const key = JSON.stringify(cfg);
  const hit = cache.get(key);
  if (hit) return hit;

  const { seed, backgroundColor, ...rest } = cfg;
  const options: Record<string, unknown> = { seed: String(seed ?? 'friendegle'), backgroundColor: [backgroundColor ?? 'b6e3f4'] };
  for (const [k, v] of Object.entries(rest)) options[k] = k.endsWith('Probability') ? Number(v) : [v];
  // La barba del mismo color que el pelo
  if (rest.hairColor) options.facialHairColor = [rest.hairColor];

  let uri: string;
  try {
    uri = createAvatar(avataaars, options).toDataUri();
  } catch {
    uri = createAvatar(avataaars, { seed: String(seed ?? 'friendegle') }).toDataUri();
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, uri);
  return uri;
}

/** Avatar por defecto para quien no tiene cuenta: aleatorio pero estable para una etiqueta (User_XXXX). */
export const anonymousAvatar = (label: string) => serializeAvatar({ seed: label });
