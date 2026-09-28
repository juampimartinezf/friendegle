import { useState } from 'react';
import { AVATAR_CATEGORIES, avatarDataUri, parseAvatar, randomSeed, serializeAvatar, type AvatarConfig } from '../avatar';

// Avatares antiguos (emoji). Se siguen mostrando para cuentas que aún no han personalizado el suyo.
export const AVATARS: Record<string, { emoji: string; bg: string }> = {
  fox: { emoji: '🦊', bg: 'bg-orange-500' },
  cat: { emoji: '🐱', bg: 'bg-amber-400' },
  panda: { emoji: '🐼', bg: 'bg-slate-300' },
  owl: { emoji: '🦉', bg: 'bg-yellow-700' },
  frog: { emoji: '🐸', bg: 'bg-green-500' },
  tiger: { emoji: '🐯', bg: 'bg-orange-400' },
  koala: { emoji: '🐨', bg: 'bg-zinc-400' },
  octopus: { emoji: '🐙', bg: 'bg-pink-500' },
  unicorn: { emoji: '🦄', bg: 'bg-fuchsia-400' },
  penguin: { emoji: '🐧', bg: 'bg-sky-500' },
  lion: { emoji: '🦁', bg: 'bg-amber-500' },
  whale: { emoji: '🐳', bg: 'bg-blue-500' },
};

export function avatarFor(avatarUrl: string | null | undefined) {
  const key = avatarUrl?.startsWith('preset:') ? avatarUrl.slice(7) : '';
  return AVATARS[key] ?? { emoji: '👤', bg: 'bg-slate-600' };
}

const SIZES = { xs: 'size-6 text-sm', sm: 'size-9 text-lg', md: 'size-12 text-2xl', lg: 'size-24 text-5xl', xl: 'size-40 text-7xl' };

export function Avatar({ avatarUrl, size = 'md' }: { avatarUrl: string | null | undefined; size?: keyof typeof SIZES }) {
  const cfg = parseAvatar(avatarUrl);
  if (cfg) {
    return (
      <img
        src={avatarDataUri(cfg)}
        alt=""
        className={`${SIZES[size]} shrink-0 rounded-full object-cover ring-2 ring-surface`}
        draggable={false}
      />
    );
  }
  const a = avatarFor(avatarUrl);
  return (
    <div className={`${SIZES[size]} ${a.bg} grid shrink-0 place-items-center rounded-full ring-2 ring-surface`}>
      <span aria-hidden>{a.emoji}</span>
    </div>
  );
}

/** Editor de avatar por categorías, con vista previa de cada opción aplicada sobre el avatar actual. */
export default function AvatarPicker({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const [fallbackSeed] = useState(randomSeed); // cuentas con avatar antiguo: punto de partida estable
  const cfg: AvatarConfig = parseAvatar(value) ?? { seed: fallbackSeed };
  const [tab, setTab] = useState(AVATAR_CATEGORIES[0].key);
  const category = AVATAR_CATEGORIES.find((c) => c.key === tab)!;

  const set = (patch: AvatarConfig, remove: string[] = []) => {
    const next: AvatarConfig = { ...cfg, ...patch };
    for (const k of remove) delete next[k];
    onChange(serializeAvatar(next));
  };

  const choose = (option: string | null) => {
    const prob = category.noneProbability;
    if (option === null) return set({ [prob!]: 0 }, [category.key]);
    set({ [category.key]: option, ...(prob ? { [prob]: 100 } : {}) });
  };

  const isNone = category.noneProbability !== undefined && Number(cfg[category.noneProbability]) === 0;
  const selected = (o: string) => !isNone && cfg[category.key] === o;
  const ring = (on: boolean) => (on ? 'ring-4 ring-brand-600' : 'ring-1 ring-celeste-300 hover:ring-brand-500');

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex shrink-0 flex-col items-center gap-2">
        <Avatar avatarUrl={serializeAvatar(cfg)} size="xl" />
        <button
          type="button"
          onClick={() => onChange(serializeAvatar({ seed: randomSeed() }))}
          className="rounded-lg border border-celeste-300 px-3 py-1.5 text-sm hover:bg-celeste-100"
        >
          🎲 Aleatorio
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {AVATAR_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={tab === c.key}
              onClick={() => setTab(c.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${tab === c.key ? 'bg-brand-600 text-white' : 'bg-celeste-100 text-ink hover:bg-celeste-200'}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid max-h-64 grid-cols-5 gap-2 overflow-y-auto p-1 sm:grid-cols-6">
          {category.noneProbability && (
            <button
              type="button"
              onClick={() => choose(null)}
              aria-label="Ninguno"
              aria-pressed={isNone}
              className={`grid aspect-square place-items-center rounded-xl bg-celeste-50 text-xs text-ink-soft ${ring(isNone)}`}
            >
              Ninguno
            </button>
          )}
          {category.options.map((o) =>
            category.kind === 'color' ? (
              <button
                key={o}
                type="button"
                onClick={() => choose(o)}
                aria-label={`#${o}`}
                aria-pressed={selected(o)}
                className={`aspect-square rounded-full ${ring(selected(o))}`}
                style={{ backgroundColor: `#${o}` }}
              />
            ) : (
              <button
                key={o}
                type="button"
                onClick={() => choose(o)}
                aria-label={o}
                aria-pressed={selected(o)}
                className={`overflow-hidden rounded-xl bg-celeste-50 ${ring(selected(o))}`}
              >
                <img
                  src={avatarDataUri({ ...cfg, [category.key]: o, ...(category.noneProbability ? { [category.noneProbability]: 100 } : {}) })}
                  alt=""
                  className="aspect-square w-full"
                  loading="lazy"
                />
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
