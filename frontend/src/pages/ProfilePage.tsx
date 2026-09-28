import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AvatarPicker, { Avatar } from '../components/AvatarPicker';
import { api, formatLastSeen, REPORT_REASONS, type FriendProfile } from '../services/api';
import { Field } from './LoginPage';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-celeste-50 p-4">
      <p className="text-xs uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

/** /profile: tu perfil editable. /friends/:id: perfil de un amigo (solo lectura). */
export default function ProfilePage() {
  const { id } = useParams();
  return id ? <FriendProfileView id={Number(id)} /> : <MyProfile />;
}

function MyProfile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    realName: user?.realName ?? '',
    avatarUrl: user?.avatarUrl ?? 'preset:fox',
    bio: user?.bio ?? '',
    location: user?.location ?? '',
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | string>('idle');

  if (!user) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('saving');
    try {
      const { user } = await api.updateProfile(form);
      setUser(user);
      setStatus('saved');
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Mi perfil</h1>
      <p className="mb-6 mt-1 text-sm text-ink-soft">🔒 Solo tus amigos pueden ver esta información. Nunca aparece en el chat.</p>

      <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-celeste-200 bg-surface p-6">
        <div className="flex items-center gap-4">
          <Avatar avatarUrl={form.avatarUrl} size="lg" />
          <div>
            <p className="text-xl font-bold">{form.realName || user.username}</p>
            <p className="text-sm text-ink-soft">@{user.username}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Avatar</p>
          <AvatarPicker value={form.avatarUrl} onChange={(avatarUrl) => setForm({ ...form, avatarUrl })} />
        </div>

        <Field label="Nombre real" maxLength={60} value={form.realName} onChange={(e) => setForm({ ...form, realName: e.target.value })} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Bio (opcional)</span>
          <textarea
            maxLength={280}
            rows={3}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="w-full rounded-lg border border-celeste-300 bg-celeste-50 px-3 py-2.5 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-500/25"
          />
        </label>
        <Field
          label="Ubicación (opcional)"
          maxLength={60}
          placeholder="Ej: Buenos Aires"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          hint="Consejo: pon solo tu ciudad o país, nunca tu dirección."
        />

        <div className="flex items-center gap-3">
          <button
            disabled={status === 'saving'}
            className="rounded-lg bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {status === 'saving' ? 'Guardando…' : 'Guardar'}
          </button>
          {status === 'saved' && <span className="text-sm text-emerald-600 dark:text-emerald-400">Guardado ✓</span>}
          {!['idle', 'saving', 'saved'].includes(status) && <span className="text-sm text-rose-600 dark:text-rose-400">{status}</span>}
        </div>
      </form>
    </div>
  );
}

function FriendProfileView({ id }: { id: number }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    api
      .friendProfile(id)
      .then(({ profile }) => setProfile(profile))
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="p-10 text-center text-ink-soft">
        <p className="text-4xl">🔒</p>
        <p className="mt-3">{error}. Solo puedes ver perfiles de tus amigos.</p>
      </div>
    );
  }
  if (!profile) return <p className="p-10 text-center text-ink-soft">Cargando…</p>;

  async function block() {
    if (!confirm('¿Bloquear a este amigo? Se eliminará la amistad y no volverán a coincidir en el chat.')) return;
    await api.blockFriend(profile!.id);
    navigate('/friends');
  }

  async function report(reason: string) {
    await api.reportFriend(profile!.id, reason);
    setReporting(false);
    alert('Reporte enviado.');
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <button onClick={() => navigate('/friends')} className="mb-4 text-sm text-ink-soft hover:text-ink">
        ← Mis amigos
      </button>
      <div className="rounded-2xl border border-celeste-200 bg-surface p-6">
        <div className="flex items-center gap-5">
          <Avatar avatarUrl={profile.avatar_url} size="lg" />
          <div>
            <h1 className="text-2xl font-bold">{profile.real_name || profile.username}</h1>
            <p className="text-sm text-ink-soft">@{profile.username}</p>
          </div>
        </div>
        {profile.bio && <p className="mt-6 whitespace-pre-wrap leading-relaxed text-ink">{profile.bio}</p>}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Stat label="Ubicación" value={profile.location || '—'} />
          <Stat label="En línea" value={formatLastSeen(profile.is_online, profile.last_seen)} />
        </div>
        <div className="mt-8 flex flex-wrap gap-2 border-t border-celeste-200 pt-4">
          <button onClick={() => setReporting(!reporting)} className="rounded-lg px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-400/10">
            🚩 Reportar
          </button>
          <button onClick={block} className="rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-400/10">
            ⛔ Bloquear
          </button>
        </div>
        {reporting && (
          <div className="mt-3 flex flex-wrap gap-2">
            {REPORT_REASONS.map((r) => (
              <button key={r.value} onClick={() => report(r.value)} className="rounded-full border border-celeste-200 px-3 py-1 text-xs hover:border-amber-400">
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
