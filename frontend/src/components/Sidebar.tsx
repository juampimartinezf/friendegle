import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from './AvatarPicker';

const ITEMS = [
  { to: '/', label: 'Inicio', icon: '🏠', needsAccount: false },
  { to: '/profile', label: 'Mi Perfil', icon: '🙂', needsAccount: true },
  { to: '/friends', label: 'Mis Amigos', icon: '🤝', needsAccount: true },
  { to: '/settings', label: 'Configuración', icon: '⚙️', needsAccount: false },
];

export default function Sidebar({ requestCount, onNavigate }: { requestCount: number; onNavigate?: () => void }) {
  const { user } = useAuth();

  return (
    <nav className="flex h-full w-64 flex-col gap-6 border-r border-celeste-300 bg-celeste-200 p-4">
      <div className="flex items-center gap-3 rounded-xl bg-surface/70 p-3 shadow-sm">
        <Avatar avatarUrl={user?.avatarUrl} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{user ? user.realName || user.username : 'Anónimo'}</p>
          <p className="truncate text-xs text-ink-soft">{user ? `@${user.username}` : 'Sin cuenta'}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        {ITEMS.map((item) => {
          const disabled = item.needsAccount && !user;
          if (disabled) {
            return (
              <li key={item.to} title="Crea una cuenta para usar esto">
                <span className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-ink-soft/50">
                  <span>{item.icon}</span>
                  {item.label}
                  <span className="ml-auto text-xs">🔒</span>
                </span>
              </li>
            );
          }
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 transition ${
                    isActive ? 'bg-surface font-semibold text-accent shadow-sm' : 'text-ink hover:bg-surface/50'
                  }`
                }
              >
                <span>{item.icon}</span>
                {item.label}
                {item.to === '/friends' && requestCount > 0 && (
                  <span className="ml-auto rounded-full bg-brand-600 px-2 text-xs font-bold text-white">{requestCount}</span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>

      <p className="mt-auto rounded-lg bg-surface/60 p-3 text-xs leading-relaxed text-ink-soft">
        🔒 En el chat eres un <b className="text-ink">User_XXXX</b>. Tu perfil solo lo ven tus amigos.
      </p>
    </nav>
  );
}
