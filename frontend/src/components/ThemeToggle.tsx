import { useTheme } from '../hooks/useTheme';

/** 🌙 cambia a oscuro, ☀️ cambia a claro. */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const toDark = theme === 'light';
  const label = toDark ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`grid size-9 place-items-center rounded-lg border border-celeste-300 text-lg transition hover:bg-celeste-100 ${className}`}
    >
      <span aria-hidden>{toDark ? '🌙' : '☀️'}</span>
    </button>
  );
}
