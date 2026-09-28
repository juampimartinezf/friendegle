import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-10 p-6 text-center">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">
          {user ? `Hola, ${user.realName || user.username} 👋` : 'Hola, desconocido 👋'}
        </h1>
        <p className="mt-2 text-ink-soft">Conecta con alguien al azar. Nadie sabrá quién eres a menos que se hagan amigos.</p>
      </div>

      <Link
        to="/chat"
        className="group relative grid size-56 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-black tracking-wide text-white shadow-[0_0_80px_-10px] shadow-brand-500 transition hover:scale-105 active:scale-95 sm:size-64 sm:text-3xl"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/20" />
        <span className="relative">
          🎥
          <br />
          INICIAR CHAT
        </span>
      </Link>

      <div className="flex flex-col items-center gap-3">
        <Link to="/chat?demo=1" className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          Probar primero con un bot de prueba
        </Link>
        <div className="grid max-w-2xl gap-3 text-left text-sm sm:grid-cols-3">
          {[
            ['🎭', 'Anónimo', 'En el chat solo eres User_XXXX.'],
            ['🤝', 'Amigos', 'Si conectan, agrégense y vean su perfil.'],
            ['🚩', 'Seguro', 'Reporta o bloquea con un clic.'],
          ].map(([icon, title, text]) => (
            <div key={title} className="rounded-xl border border-celeste-200 bg-surface p-4">
              <p className="font-semibold">
                {icon} {title}
              </p>
              <p className="mt-1 text-ink-soft">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
