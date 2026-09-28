import type { StreakView } from '../services/api';

/** 🔥 racha con un amigo. Naranja si está al día; ámbar/rojo con aviso si está en peligro (rota y recuperable). */
export default function StreakBadge({ streak, detailed = false }: { streak?: StreakView; detailed?: boolean }) {
  if (!streak || streak.status === 'none') return null;
  const days = `${streak.count} ${streak.count === 1 ? 'día' : 'días'}`;

  if (streak.status === 'at_risk') {
    const left = streak.chancesLeft === 1 ? 'solo queda hoy' : `quedan ${streak.chancesLeft} días`;
    return (
      <span
        title={`Racha en peligro: chateen para recuperarla (${left})`}
        className={`inline-flex shrink-0 flex-wrap items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 ${detailed ? '' : 'whitespace-nowrap'}`}
      >
        ⚠️🔥 {days}
        {detailed && <span className="font-medium">· en peligro, {left} para recuperarla</span>}
      </span>
    );
  }
  return (
    <span
      title="Racha: días seguidos chateando"
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
    >
      🔥 {days}
    </span>
  );
}
