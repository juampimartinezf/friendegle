import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Header';
import ThemeToggle from './ThemeToggle';
import { LegalLinks } from './LegalConsent';
import { LEGAL } from '../legal';

/** Página legal pública (sin necesidad de sesión). */
export default function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-full bg-celeste-100">
      <header className="flex h-14 items-center justify-between border-b border-celeste-200 bg-surface/85 px-4 backdrop-blur">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/" className="text-sm text-ink-soft hover:text-ink">
          ← Volver a Friendegle
        </Link>
        <article className="mt-4 rounded-2xl border border-celeste-200 bg-surface p-6 leading-relaxed sm:p-8 [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:space-y-1">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          <p className="text-sm text-ink-soft">Última actualización: {LEGAL.lastUpdated}</p>
          {children}
        </article>
        <LegalLinks className="mt-6 text-center" />
      </main>
    </div>
  );
}
