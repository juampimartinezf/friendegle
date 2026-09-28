import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { LegalLinks } from '../components/LegalConsent';

/** Eliminación definitiva de la cuenta, con la contraseña como confirmación. */
function DeleteAccount() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!confirm('Esta acción no se puede deshacer. ¿Eliminar tu cuenta definitivamente?')) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteAccount(password);
      logout();
      navigate('/login');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-rose-300 bg-surface p-6 dark:border-rose-500/40">
      <h2 className="font-semibold text-rose-600 dark:text-rose-400">Eliminar cuenta</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Se borran tu perfil, tus amistades, tus bloqueos y tu historial. Los reportes se conservan sin vínculo a tu cuenta.
      </p>
      {open ? (
        <form onSubmit={onSubmit} className="mt-4 flex flex-wrap gap-2">
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-celeste-300 bg-celeste-50 px-3 py-2 text-sm outline-none focus:border-rose-500"
          />
          <button disabled={busy} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50">
            {busy ? 'Eliminando…' : 'Eliminar definitivamente'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-celeste-100">
            Cancelar
          </button>
          {error && <p className="w-full text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-4 rounded-lg border border-rose-300 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-400 dark:hover:bg-rose-400/10">
          Eliminar mi cuenta…
        </button>
      )}
    </section>
  );
}

const PRIVACY = [
  ['🎭', 'En cada chat recibes un nombre anónimo nuevo (User_XXXX). Tu nombre, usuario y email nunca se envían al desconocido.'],
  ['🔍', 'No existe buscador ni lista pública de usuarios. Nadie puede encontrarte si no te conoció en un chat.'],
  ['🤝', 'Tu perfil solo es visible para amigos aceptados. Eliminar o bloquear a alguien le retira el acceso al instante.'],
  ['🛡️', 'El contenido sexual se detecta automáticamente en tu navegador y se oculta al instante. El vídeo nunca se graba ni se envía a ningún servidor.'],
  ['🚩', 'Reportar termina el chat y (si ambos tienen cuenta) bloquea al usuario. Varios reportes suspenden el acceso al chat.'],
  ['💬', 'Los mensajes privados entre amigos se guardan para que veas el historial y solo los leéis vosotros dos. Se borran al eliminar la cuenta.'],
  ['📹', 'El vídeo y los mensajes viajan cifrados a través de un servidor de relay: el otro usuario nunca ve tu IP. No se graba ni se guarda nada.'],
];

export default function SettingsPage() {
  const { user, isAnonymous } = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Configuración</h1>

      <section className="rounded-2xl border border-celeste-200 bg-surface p-6">
        <h2 className="mb-3 font-semibold">Cuenta</h2>
        {user ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-ink-soft">Email</dt>
            <dd>{user.email}</dd>
            <dt className="text-ink-soft">Usuario</dt>
            <dd>@{user.username}</dd>
          </dl>
        ) : (
          isAnonymous && (
            <p className="text-sm text-ink">
              Estás en modo anónimo. <Link to="/register" className="text-accent hover:underline">Crea una cuenta</Link> para
              poder agregar amigos.
            </p>
          )
        )}
      </section>

      <section className="rounded-2xl border border-celeste-200 bg-surface p-6">
        <h2 className="mb-4 font-semibold">Cómo protegemos tu privacidad</h2>
        <ul className="space-y-3 text-sm text-ink">
          {PRIVACY.map(([icon, text]) => (
            <li key={text} className="flex gap-3">
              <span>{icon}</span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>

      {user && <DeleteAccount />}
      <LegalLinks className="text-center" />
    </div>
  );
}
