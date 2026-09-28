import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../services/analytics';
import { useAuth } from '../hooks/useAuth';
import { AnonymousButton, AuthShell, Field, PrimaryButton } from './LoginPage';
import LegalConsent from '../components/LegalConsent';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  // Código del enlace de invitación de un amigo (/register?ref=...)
  const ref = useSearchParams()[0].get('ref') || undefined;
  const [form, setForm] = useState({ email: '', username: '', realName: '', password: '', confirm: '' });
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden');
    if (!accepted) return setError('Debes confirmar que tienes 18 años o más y aceptar los términos');
    setLoading(true);
    try {
      await register({
        email: form.email,
        username: form.username,
        realName: form.realName || undefined,
        password: form.password,
        ref,
        acceptTerms: true,
      });
      track('Registro', { invitado: !!ref });
      navigate('/profile');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Crea tu cuenta" subtitle="Tu nombre real solo lo verán las personas que aceptes como amigas.">
      {ref && (
        <p className="mb-4 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-900 dark:bg-orange-500/10 dark:text-orange-200">
          🔥 Te invitó un amigo: al crear tu cuenta serán amigos y podrán empezar una racha.
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        <Field
          label="Nombre de usuario"
          required
          pattern="[A-Za-z0-9_]{3,20}"
          autoComplete="username"
          value={form.username}
          onChange={set('username')}
          hint="3-20 caracteres. Solo tus amigos lo ven; en el chat serás User_XXXX."
        />
        <Field label="Nombre real (opcional)" autoComplete="name" maxLength={60} value={form.realName} onChange={set('realName')} />
        <Field
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={set('password')}
          hint="Mínimo 8 caracteres."
        />
        <Field label="Repite la contraseña" type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} />
        <LegalConsent checked={accepted} onChange={setAccepted} />
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{error}</p>}
        <PrimaryButton loading={loading}>Crear cuenta</PrimaryButton>
      </form>
      <p className="mt-4 text-center text-sm text-ink-soft">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-semibold text-accent hover:underline">
          Inicia sesión
        </Link>
      </p>
      <AnonymousButton />
    </AuthShell>
  );
}
