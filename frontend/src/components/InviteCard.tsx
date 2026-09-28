import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { track } from '../services/analytics';

/** Enlace de invitación: quien se registra con él y quien lo compartió quedan como amigos automáticamente. */
export default function InviteCard() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  if (!user?.referralCode) return null;
  const link = `${location.origin}/register?ref=${user.referralCode}`;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    track('Invitación copiada');
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'Friendegle', text: 'Hablemos por Friendegle y empecemos una racha 🔥', url: link });
      track('Invitación compartida');
    } catch {
      // cancelado por el usuario
    }
  };

  return (
    <div className="w-full max-w-2xl rounded-xl border border-orange-200 bg-orange-50 p-4 text-left dark:border-orange-500/30 dark:bg-orange-500/10">
      <p className="font-bold">Invita un amigo y empiecen una racha 🔥</p>
      <p className="mt-0.5 text-sm text-ink-soft">Cuando cree su cuenta con tu enlace, serán amigos automáticamente.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          aria-label="Tu enlace de invitación"
          className="min-w-0 flex-1 basis-48 rounded-lg border border-celeste-200 bg-surface px-3 py-2 text-sm"
        />
        <button onClick={copy} className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
        {'share' in navigator && (
          <button onClick={share} className="shrink-0 rounded-lg bg-celeste-100 px-4 py-2 text-sm font-semibold hover:bg-celeste-200">
            Compartir
          </button>
        )}
      </div>
    </div>
  );
}
