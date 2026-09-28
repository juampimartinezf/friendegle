import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Logo } from '../components/Header';
import ThemeToggle from '../components/ThemeToggle';
import LegalConsent, { LegalLinks } from '../components/LegalConsent';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative grid min-h-full place-items-center bg-[radial-gradient(ellipse_at_top,var(--color-celeste-200)_0%,var(--color-celeste-100)_65%)] p-4">
      <ThemeToggle className="absolute right-4 top-4 bg-surface/70" />
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-celeste-200 bg-surface/90 p-8 shadow-xl shadow-brand-700/10 backdrop-blur">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-ink-soft">{subtitle}</p>
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-ink-soft">
          Sin buscador · Sin perfiles públicos · Anónimo en el chat · Solo mayores de 18
        </p>
        <LegalLinks className="mt-2 text-center" />
      </div>
    </div>
  );
}

export function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const { label, hint, ...input } = props;
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input
        {...input}
        className="w-full rounded-lg border border-celeste-300 bg-celeste-50 px-3 py-2.5 outline-none transition placeholder:text-ink-soft/60 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/25"
      />
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

export function PrimaryButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button
      disabled={loading}
      className="w-full rounded-lg bg-gradient-to-r from-brand-500 to-brand-700 py-3 font-bold text-white shadow-lg shadow-brand-700/30 transition hover:brightness-110 disabled:opacity-60"
    >
      {loading ? 'Un momento…' : children}
    </button>
  );
}

export function AnonymousButton() {
  const { continueAnonymously } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);

  if (open) {
    return (
      <div className="mt-6 space-y-3 border-t border-celeste-200 pt-6">
        <p className="text-sm font-semibold">🕶️ Entrar como anónimo</p>
        <LegalConsent checked={accepted} onChange={setAccepted} />
        <button
          type="button"
          disabled={!accepted}
          onClick={() => {
            continueAnonymously();
            navigate('/');
          }}
          className="w-full rounded-lg bg-brand-600 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
        >
          Continuar como anónimo
        </button>
        <button type="button" onClick={() => setOpen(false)} className="w-full text-sm text-ink-soft hover:text-ink">
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="my-6 flex items-center gap-3 text-xs text-ink-soft">
        <div className="h-px flex-1 bg-celeste-100" /> o <div className="h-px flex-1 bg-celeste-100" />
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-celeste-300 py-3 font-semibold text-ink transition hover:bg-celeste-50"
      >
        🕶️ Continuar como anónimo
      </button>
      <p className="mt-2 text-center text-xs text-ink-soft">Sin cuenta no podrás agregar amigos.</p>
    </>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Bienvenido de vuelta" subtitle="Conoce gente nueva sin exponer quién eres.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{error}</p>}
        <PrimaryButton loading={loading}>Entrar</PrimaryButton>
      </form>
      <p className="mt-4 text-center text-sm text-ink-soft">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="font-semibold text-accent hover:underline">
          Regístrate
        </Link>
      </p>
      <AnonymousButton />
    </AuthShell>
  );
}
