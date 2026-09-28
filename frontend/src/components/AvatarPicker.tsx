// Avatares predefinidos: no se suben imágenes ni se aceptan URLs externas.
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

const SIZES = { sm: 'size-9 text-lg', md: 'size-12 text-2xl', lg: 'size-24 text-5xl' };

export function Avatar({ avatarUrl, size = 'md' }: { avatarUrl: string | null | undefined; size?: keyof typeof SIZES }) {
  const a = avatarFor(avatarUrl);
  return (
    <div className={`${SIZES[size]} ${a.bg} grid shrink-0 place-items-center rounded-full ring-2 ring-surface`}>
      <span aria-hidden>{a.emoji}</span>
    </div>
  );
}

export default function AvatarPicker({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-3">
      {Object.entries(AVATARS).map(([key, a]) => {
        const id = `preset:${key}`;
        const selected = value === id;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(id)}
            aria-label={key}
            aria-pressed={selected}
            className={`${a.bg} grid aspect-square place-items-center rounded-full text-2xl transition ${
              selected ? 'scale-110 ring-4 ring-brand-600' : 'opacity-70 hover:opacity-100'
            }`}
          >
            {a.emoji}
          </button>
        );
      })}
    </div>
  );
}
