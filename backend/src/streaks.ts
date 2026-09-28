import { config } from './config.js';
import { db } from './database/db.js';

/**
 * Rachas entre amigos (estilo Snapchat).
 *
 * - Un día cuenta si ese día los DOS se escribieron por Mensajes, o si tuvieron una videollamada (≥ 10 s).
 * - Día siguiente al último contado → +1.
 * - Si se salta un día, la racha se "rompe" pero no se pierde: ese día fallado es el intento 1.
 *   Chatear en cualquiera de los días siguientes antes de fallar 3 la recupera (y suma el día de hoy).
 * - Al 3er día fallado, la racha se reinicia a 0.
 *
 * Días calendario en la zona horaria de config.streakUtcOffsetHours (por defecto UTC−3, Argentina).
 */

export const MAX_RECOVERY_ATTEMPTS = 3;

export interface StreakState {
  streak_count: number;
  last_streak_day: string | null;
  streak_broken_at: string | null;
  recovery_attempts: number;
}

export type StreakEvent = 'started' | 'increment' | 'broken' | 'attempt_failed' | 'recovered' | 'reset';

export interface StreakView {
  count: number;
  /** 'active' al día · 'at_risk' rota y recuperable · 'none' sin racha */
  status: 'active' | 'at_risk' | 'none';
  /** Días que quedan para recuperarla, contando hoy (solo si está en peligro) */
  chancesLeft: number;
}

const DAY_MS = 86_400_000;
export const dayOf = (ms: number) => new Date(ms + config.streakUtcOffsetHours * 3_600_000).toISOString().slice(0, 10);
export const today = () => dayOf(Date.now());
const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

/** Días completos sin chatear desde el último día contado (0 = el último fue ayer u hoy). */
export function missedDays(s: StreakState, day: string): number {
  return s.last_streak_day ? Math.max(0, daysBetween(s.last_streak_day, day) - 1) : 0;
}

/** Nuevo estado al registrar que HOY chatearon. */
export function applyChatDay(s: StreakState, day: string): { next: StreakState; event: StreakEvent | null } {
  if (s.last_streak_day === day) return { next: s, event: null };
  const missed = missedDays(s, day);
  let count: number;
  let event: StreakEvent;
  if (!s.last_streak_day || s.streak_count === 0 || missed >= MAX_RECOVERY_ATTEMPTS) {
    count = 1;
    event = 'started';
  } else if (missed === 0) {
    count = s.streak_count + 1;
    event = 'increment';
  } else {
    count = s.streak_count + 1;
    event = 'recovered';
  }
  return { next: { streak_count: count, last_streak_day: day, streak_broken_at: null, recovery_attempts: 0 }, event };
}

/** Lo que ve el usuario hoy (sin escribir nada: coherente aunque el barrido aún no haya pasado). */
export function streakView(s: StreakState, day: string): StreakView {
  const missed = missedDays(s, day);
  if (!s.last_streak_day || s.streak_count === 0 || missed >= MAX_RECOVERY_ATTEMPTS) return { count: 0, status: 'none', chancesLeft: 0 };
  if (missed >= 1) return { count: s.streak_count, status: 'at_risk', chancesLeft: MAX_RECOVERY_ATTEMPTS - missed };
  return { count: s.streak_count, status: 'active', chancesLeft: 0 };
}

/** Estado persistido tras pasar días sin chatear (lo aplica el barrido periódico). */
export function applyMissedDays(s: StreakState, day: string): { next: StreakState; event: StreakEvent | null } {
  const missed = missedDays(s, day);
  if (s.streak_count === 0 || missed === 0 || missed === s.recovery_attempts) return { next: s, event: null };
  if (missed >= MAX_RECOVERY_ATTEMPTS) {
    return { next: { streak_count: 0, last_streak_day: s.last_streak_day, streak_broken_at: null, recovery_attempts: 0 }, event: 'reset' };
  }
  return {
    next: { ...s, streak_broken_at: s.streak_broken_at ?? addDays(s.last_streak_day!, 1), recovery_attempts: missed },
    event: s.recovery_attempts === 0 ? 'broken' : 'attempt_failed',
  };
}

// ---------------------------------------------------------------- base de datos

type FriendshipRow = StreakState & { id: number };

function friendship(a: number, b: number): FriendshipRow | undefined {
  return db
    .prepare(
      `SELECT id, streak_count, last_streak_day, streak_broken_at, recovery_attempts FROM friends
       WHERE status = 'accepted' AND ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))`,
    )
    .get(a, b, b, a) as FriendshipRow | undefined;
}

function save(id: number, s: StreakState, event: StreakEvent) {
  db.prepare(
    `UPDATE friends SET streak_count = ?, last_streak_day = ?, streak_broken_at = ?, recovery_attempts = ? WHERE id = ?`,
  ).run(s.streak_count, s.last_streak_day, s.streak_broken_at, s.recovery_attempts, id);
  db.prepare('INSERT INTO streak_logs (friendship_id, event, streak_count, recovery_attempts) VALUES (?, ?, ?, ?)').run(
    id,
    event,
    s.streak_count,
    s.recovery_attempts,
  );
}

/** Registra que hoy chatearon (idempotente por día). Devuelve true si la racha cambió. */
export function recordFriendChatDay(a: number, b: number): boolean {
  const f = friendship(a, b);
  if (!f) return false;
  const { next, event } = applyChatDay(f, today());
  if (!event) return false;
  db.transaction(() => {
    // Si el barrido no llegó a reiniciarla, dejar constancia del reinicio antes del nuevo comienzo
    if (event === 'started' && f.streak_count > 0) save(f.id, { ...f, streak_count: 0, recovery_attempts: 0, streak_broken_at: null }, 'reset');
    save(f.id, next, event);
  })();
  return true;
}

/** ¿Se escribieron los DOS hoy? (mensajes privados, día en la zona horaria de las rachas) */
export function bothMessagedToday(a: number, b: number): boolean {
  const offset = `${config.streakUtcOffsetHours >= 0 ? '+' : ''}${config.streakUtcOffsetHours} hours`;
  const sent = (from: number, to: number) =>
    !!db
      .prepare(
        `SELECT 1 FROM direct_messages WHERE sender_id = ? AND recipient_id = ? AND date(created_at, ?) = ? LIMIT 1`,
      )
      .get(from, to, offset, today());
  return sent(a, b) && sent(b, a);
}

/** Barrido periódico: marca rachas rotas, intentos fallados y reinicios (con log). */
export function sweepStreaks(): number {
  const rows = db
    .prepare(
      `SELECT id, streak_count, last_streak_day, streak_broken_at, recovery_attempts FROM friends
       WHERE status = 'accepted' AND streak_count > 0`,
    )
    .all() as FriendshipRow[];
  const day = today();
  let changed = 0;
  db.transaction(() => {
    for (const f of rows) {
      const { next, event } = applyMissedDays(f, day);
      if (event) {
        save(f.id, next, event);
        changed++;
      }
    }
  })();
  return changed;
}

/** Añade `streak` (vista para la UI) a filas que traen las columnas de racha. */
export function withStreak<T extends StreakState>(row: T): Omit<T, keyof StreakState> & { streak: StreakView } {
  const { streak_count, last_streak_day, streak_broken_at, recovery_attempts, ...rest } = row;
  return { ...rest, streak: streakView({ streak_count, last_streak_day, streak_broken_at, recovery_attempts }, today()) };
}

// Autocomprobación de la lógica de días: npx tsx src/streaks.ts
if (process.argv[1]?.endsWith('streaks.ts')) {
  const ok = (c: boolean, m: string) => {
    console.log(c ? 'ok  ' : 'FAIL', m);
    if (!c) process.exitCode = 1;
  };
  const empty: StreakState = { streak_count: 0, last_streak_day: null, streak_broken_at: null, recovery_attempts: 0 };
  let s = applyChatDay(empty, '2026-10-01').next;
  ok(s.streak_count === 1, 'primer día de chat -> racha 1');
  ok(applyChatDay(s, '2026-10-01').event === null, 'segundo chat el mismo día no suma');
  for (const d of ['02', '03', '04', '05', '06', '07']) s = applyChatDay(s, `2026-10-${d}`).next;
  ok(s.streak_count === 7 && streakView(s, '2026-10-08').status === 'active', '7 días seguidos -> racha 7, al día siguiente sigue activa');
  const v1 = streakView(s, '2026-10-09');
  ok(v1.status === 'at_risk' && v1.count === 7 && v1.chancesLeft === 2, 'no hablan el día 8 -> en peligro, se conserva el 7, quedan 2 días');
  const b1 = applyMissedDays(s, '2026-10-09');
  ok(b1.event === 'broken' && b1.next.recovery_attempts === 1 && b1.next.streak_broken_at === '2026-10-08', 'barrido: rota el día 8, intento 1');
  const b2 = applyMissedDays(b1.next, '2026-10-10');
  ok(b2.event === 'attempt_failed' && b2.next.recovery_attempts === 2, 'barrido: tampoco el día 9 -> intento 2');
  ok(streakView(b2.next, '2026-10-10').chancesLeft === 1, 'último día para recuperarla');
  const rec = applyChatDay(b2.next, '2026-10-10');
  ok(rec.event === 'recovered' && rec.next.streak_count === 8 && rec.next.recovery_attempts === 0, 'chatean el día 10 -> recuperada (8)');
  const b3 = applyMissedDays(b2.next, '2026-10-11');
  ok(b3.event === 'reset' && b3.next.streak_count === 0, 'tercer día fallado -> reiniciada a 0');
  ok(streakView(s, '2026-10-11').status === 'none', 'la vista también la muestra reiniciada sin esperar al barrido');
  ok(applyChatDay(s, '2026-10-11').event === 'started' && applyChatDay(s, '2026-10-11').next.streak_count === 1, 'chatear después del reinicio empieza de nuevo en 1');
  ok(applyMissedDays(b1.next, '2026-10-09').event === null, 'el barrido es idempotente');
}
