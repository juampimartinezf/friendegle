import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { config } from '../config.js';

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.exec(readFileSync(join(import.meta.dirname, 'init.sql'), 'utf8'));

/** Migración mínima: añade una columna si una BD creada con una versión anterior no la tiene. */
function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn('users', 'terms_accepted_at', 'TIMESTAMP'); // confirmó 18+ y aceptó términos al registrarse
ensureColumn('users', 'banned_at', 'TIMESTAMP'); // suspendido por moderación
ensureColumn('reports', 'status', "TEXT DEFAULT 'open'"); // 'open' | 'dismissed' | 'actioned'
ensureColumn('reports', 'reviewed_at', 'TIMESTAMP');
ensureColumn('reports', 'reviewed_by', 'INTEGER');
ensureColumn('users', 'banned_until', 'TIMESTAMP'); // ban temporal (moderación automática)
ensureColumn('ip_bans', 'expires_at', 'TIMESTAMP'); // NULL = permanente
ensureColumn('friends', 'last_streak_day', 'TEXT'); // último día (YYYY-MM-DD) que contó para la racha
ensureColumn('friends', 'streak_broken_at', 'TEXT'); // día en que se rompió (NULL si está activa)
ensureColumn('friends', 'recovery_attempts', 'INTEGER DEFAULT 0'); // días fallados desde que se rompió (0-3)
ensureColumn('users', 'referral_code', 'TEXT'); // código del enlace de invitación
ensureColumn('users', 'referred_by', 'INTEGER'); // quién lo invitó (si se registró con su enlace)
db.exec('CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at)');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)');

/** Código de invitación aleatorio (sin caracteres ambiguos). */
export function newReferralCode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  for (;;) {
    const code = Array.from(randomBytes(8), (b) => chars[b % chars.length]).join('');
    if (!db.prepare('SELECT 1 FROM users WHERE referral_code = ?').get(code)) return code;
  }
}
// Cuentas anteriores a las invitaciones
for (const { id } of db.prepare('SELECT id FROM users WHERE referral_code IS NULL').all() as { id: number }[]) {
  db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(newReferralCode(), id);
}

// Nadie está en línea al arrancar el servidor
db.prepare('UPDATE users SET is_online = FALSE').run();

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  username: string;
  real_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  is_online: number;
  last_seen: string | null;
  streak_count: number;
  last_chat_date: string | null;
  terms_accepted_at: string | null;
  banned_at: string | null;
  referral_code: string | null;
  created_at: string;
}

/** Ban vigente de una cuenta: permanente (banned_at) o temporal (banned_until en el futuro). */
export function userBan(userId: number): { permanent: boolean; until: string | null } | null {
  const u = db
    .prepare(
      `SELECT banned_at, CASE WHEN banned_until > datetime('now') THEN banned_until END AS until FROM users WHERE id = ?`,
    )
    .get(userId) as { banned_at: string | null; until: string | null } | undefined;
  if (!u || (!u.banned_at && !u.until)) return null;
  return { permanent: !!u.banned_at, until: u.banned_at ? null : u.until };
}

export function isUserBanned(userId: number): boolean {
  return userBan(userId) !== null;
}

export function isIpBanned(ipHash: string): boolean {
  return !!db
    .prepare(`SELECT 1 FROM ip_bans WHERE ip_hash = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`)
    .get(ipHash);
}

/** Mensaje para el usuario suspendido, con la fecha de fin si es temporal. */
export function banMessage(ban: { permanent: boolean; until: string | null }): string {
  return ban.permanent
    ? 'Tu cuenta está suspendida de forma permanente por incumplir las normas de Friendegle'
    : `Tu cuenta está suspendida hasta el ${ban.until} (UTC) por incumplir las normas de Friendegle`;
}

/** Campos que un amigo puede ver. Nunca email ni hash. */
export const FRIEND_PROFILE_COLUMNS =
  'u.id, u.username, u.real_name, u.avatar_url, u.bio, u.location, u.is_online, u.last_seen, u.streak_count';

export function areFriends(a: number, b: number): boolean {
  return !!db
    .prepare(
      `SELECT 1 FROM friends WHERE status = 'accepted'
       AND ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))`,
    )
    .get(a, b, b, a);
}

export function isBlockedEitherWay(a: number, b: number): boolean {
  return !!db
    .prepare(
      `SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
    )
    .get(a, b, b, a);
}

export function blockUser(blockerId: number, blockedId: number) {
  db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(blockerId, blockedId);
    // Bloquear rompe cualquier amistad o solicitud existente
    db.prepare(
      `DELETE FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
    ).run(blockerId, blockedId, blockedId, blockerId);
  })();
}

export function setOnline(userId: number, online: boolean) {
  db.prepare('UPDATE users SET is_online = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(online ? 1 : 0, userId);
}
