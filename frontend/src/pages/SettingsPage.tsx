import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const PRIVACY = [
  ['🎭', 'En cada chat recibes un nombre anónimo nuevo (User_XXXX). Tu nombre, usuario y email nunca se envían al desconocido.'],
  ['🔍', 'No existe buscador ni lista pública de usuarios. Nadie puede encontrarte si no te conoció en un chat.'],
  ['🤝', 'Tu perfil solo es visible para amigos aceptados. Eliminar o bloquear a alguien le retira el acceso al instante.'],
  ['🚩', 'Reportar termina el chat y (si ambos tienen cuenta) bloquea al usuario. Varios reportes suspenden el acceso al chat.'],
  ['📹', 'El vídeo y los mensajes viajan cifrados a través de nuestro servidor de relay: el otro usuario nunca ve tu IP. No se graba ni se guarda nada.'],
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
    </div>
  );
}
