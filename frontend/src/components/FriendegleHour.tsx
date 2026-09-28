import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { track } from '../services/analytics';

/**
 * "Hora Friendegle": todos los días a las 22:00 de Argentina (01:00 UTC) para que haya gente a la vez.
 * El aviso se guarda en localStorage y salta con Friendegle abierto (ver useFriendegleHourReminder).
 */
const HOUR_UTC = 1; // 22:00 en UTC−3
const DURATION_MS = 60 * 60 * 1000;
const REMINDER_KEY = 'friendegle_hour_reminder';
const FIRED_KEY = 'friendegle_hour_reminder_fired';

/** Inicio de la Hora Friendegle en curso o de la próxima. */
export function friendegleHour(now = Date.now()): { start: Date; live: boolean } {
  const start = new Date(now);
  start.setUTCHours(HOUR_UTC, 0, 0, 0);
  if (start.getTime() + DURATION_MS <= now) start.setUTCDate(start.getUTCDate() + 1);
  return { start, live: start.getTime() <= now };
}

/** En el reloj de quien la ve: 22:00 en Argentina, la hora equivalente en otros países. */
const hourLabel = (start: Date) => start.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      // modo privado: el aviso simplemente no se recuerda
    }
  },
};

/** Llama a `onFire` una vez por día cuando empieza la Hora Friendegle (si el usuario pidió aviso). */
export function useFriendegleHourReminder(onFire: () => void) {
  useEffect(() => {
    const check = () => {
      if (!storage.get(REMINDER_KEY)) return;
      const { start, live } = friendegleHour();
      const key = start.toISOString();
      if (!live || storage.get(FIRED_KEY) === key) return;
      storage.set(FIRED_KEY, key);
      // Pestaña en segundo plano: notificación del sistema (si dio permiso). Siempre: aviso dentro de la web.
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('🔥 ¡Es la Hora Friendegle!', { body: 'Hay más gente conectada ahora. Entra a chatear.' });
      }
      onFire();
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [onFire]);
}

export default function FriendegleHour({ compact = false }: { compact?: boolean }) {
  const [{ start, live }, setHour] = useState(() => friendegleHour());
  const [reminder, setReminder] = useState(() => !!storage.get(REMINDER_KEY));
  useEffect(() => {
    const id = setInterval(() => setHour(friendegleHour()), 30_000);
    return () => clearInterval(id);
  }, []);
  const time = hourLabel(start);

  const toggle = () => {
    const next = !reminder;
    storage.set(REMINDER_KEY, next ? '1' : null);
    setReminder(next);
    if (next) {
      track('Aviso Hora Friendegle');
      if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
    }
  };

  if (live) {
    return (
      <div className="w-full max-w-2xl rounded-xl bg-orange-100 px-4 py-3 text-left text-sm text-orange-900 dark:bg-orange-500/15 dark:text-orange-200">
        <p className="font-bold">🔥 ¡Es la Hora Friendegle!</p>
        <p className="mt-0.5">Es el momento del día en que más gente se conecta.</p>
        {!compact && (
          <Link to="/chat" className="mt-2 inline-block font-semibold underline">
            Iniciar chat →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl rounded-xl border border-celeste-200 bg-surface px-4 py-3 text-left text-sm text-ink">
      <p className="font-bold">⏰ Hora Friendegle: {time}</p>
      <p className="mt-0.5 text-ink-soft">
        Ahora hay poca gente conectada. Todos los días a las {time} nos juntamos para chatear
        {compact ? '.' : ': es cuando más rápido encuentras a alguien.'}
      </p>
      <button
        onClick={toggle}
        className={`mt-2 rounded-lg px-3 py-1.5 font-semibold ${
          reminder ? 'bg-celeste-100 text-ink hover:bg-celeste-200' : 'bg-brand-600 text-white hover:bg-brand-700'
        }`}
      >
        {reminder ? `✓ Te avisaremos a las ${time} · Cancelar` : `🔔 Avisarme a las ${time}`}
      </button>
      {reminder && <p className="mt-1 text-xs text-ink-soft">El aviso llega si tienes Friendegle abierto en alguna pestaña.</p>}
    </div>
  );
}
