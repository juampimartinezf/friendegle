import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from './AvatarPicker';
import ThemeToggle from './ThemeToggle';

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-1.5 text-lg font-extrabold tracking-tight text-accent">
      <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-sm">👋</span>
      Friendegle
    </Link>
  );
}

export default function Header({ onMenu }: { onMenu?: () => void }) {
  const { user, isAnonymous, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="flex h-14 items-center justify-between border-b border-celeste-200 bg-surface/85 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        {onMenu && (
          <button onClick={onMenu} className="rounded-lg p-2 text-ink-soft hover:bg-celeste-100 md:hidden" aria-label="Menú">
            ☰
          </button>
        )}
        <Logo />
      </div>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <Avatar avatarUrl={user.avatarUrl} size="sm" />
            <span className="hidden text-sm text-ink-soft sm:inline">@{user.username}</span>
          </>
        ) : (
          isAnonymous && <span className="rounded-full bg-celeste-100 px-3 py-1 text-xs text-ink-soft">Modo anónimo</span>
        )}
        <ThemeToggle />
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="rounded-lg border border-celeste-300 px-3 py-1.5 text-sm text-accent hover:bg-celeste-100"
        >
          Salir
        </button>
      </div>
    </header>
  );
}
