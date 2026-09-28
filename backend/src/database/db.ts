import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
db.exec('CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at)');

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
  created_at: string;
}

export function isUserBanned(userId: number): boolean {
  return !!db.prepare('SELECT 1 FROM users WHERE id = ? AND banned_at IS NOT NULL').get(userId);
}

export function isIpBanned(ipHash: string): boolean {
  return !!db.prepare('SELECT 1 FROM ip_bans WHERE ip_hash = ?').get(ipHash);
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
