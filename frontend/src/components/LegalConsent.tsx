import { Link } from 'react-router-dom';

/** Casilla de mayoría de edad + aceptación de Términos y Política de Privacidad. */
export default function LegalConsent({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-celeste-300 bg-celeste-50 p-3 text-sm">
      <input
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-brand-600"
      />
      <span>
        Confirmo que tengo <b>18 años o más</b> y acepto los{' '}
        <Link to="/terminos" target="_blank" rel="noopener" className="font-semibold text-accent hover:underline">
          Términos de uso
        </Link>{' '}
        y la{' '}
        <Link to="/privacidad" target="_blank" rel="noopener" className="font-semibold text-accent hover:underline">
          Política de privacidad
        </Link>
        .
      </span>
    </label>
  );
}

export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-ink-soft ${className}`}>
      <Link to="/terminos" className="hover:text-ink hover:underline">
        Términos de uso
      </Link>
      {' · '}
      <Link to="/privacidad" className="hover:text-ink hover:underline">
        Política de privacidad
      </Link>
    </p>
  );
}
