import { db } from './database/db.js';

/**
 * Moderación automática de contenido sexual en videochat.
 *
 * El navegador de cada usuario analiza con NSFWJS el vídeo que RECIBE (el del otro) y, si detecta
 * contenido sexual sostenido, lo comunica aquí. Nunca llega vídeo ni imágenes: solo categoría y confianza.
 *
 * Escalera (contando solo detecciones no anuladas por un admin, por cuenta o por hash de IP):
 *   1ª → advertencia · 2ª → ban de 24 h · 3ª y siguientes → ban permanente
 * El hash de IP también se suspende para dificultar abrir otra cuenta.
 * ponytail: el ban por IP "permanente" dura 30 días (IPs compartidas/NAT de móviles); ampliar si hace falta.
 */

export const AUTO_CATEGORIES = ['porn', 'hentai'] as const;
export type AutoCategory = (typeof AUTO_CATEGORIES)[number];
export type AutoAction = 'warning' | 'ban_24h' | 'ban_permanent';

/** Límite anti-abuso: detecciones que puede generar una misma persona (cuenta o IP) en 24 h. */
export const MAX_REPORTS_PER_REPORTER_PER_DAY = 5;

export function reporterQuotaExceeded(reporterUserId: number | null, reporterIpHash: string): boolean {
  const { n } = db
    .prepare(
      `SELECT COUNT(*) AS n FROM auto_violations
       WHERE created_at > datetime('now', '-1 day')
         AND (reporter_ip_hash = ? OR (? IS NOT NULL AND reporter_user_id = ?))`,
    )
    .get(reporterIpHash, reporterUserId, reporterUserId) as { n: number };
  return n >= MAX_REPORTS_PER_REPORTER_PER_DAY;
}

interface ViolationInput {
  userId: number | null;
  ipHash: string;
  label: string;
  category: AutoCategory;
  score: number;
  reporterUserId: number | null;
  reporterIpHash: string;
}

/** Registra la detección, decide la sanción según las anteriores y la aplica. */
export function recordViolation(v: ViolationInput): { id: number; action: AutoAction; until: string | null } {
  return db.transaction(() => {
    const { prior } = db
      .prepare(
        `SELECT COUNT(*) AS prior FROM auto_violations
         WHERE status = 'active' AND (ip_hash = ? OR (? IS NOT NULL AND user_id = ?))`,
      )
      .get(v.ipHash, v.userId, v.userId) as { prior: number };
    const action: AutoAction = prior === 0 ? 'warning' : prior === 1 ? 'ban_24h' : 'ban_permanent';

    const id = Number(
      db
        .prepare(
          `INSERT INTO auto_violations (user_id, ip_hash, label, category, score, action, reporter_user_id, reporter_ip_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(v.userId, v.ipHash, v.label, v.category, v.score, action, v.reporterUserId, v.reporterIpHash).lastInsertRowid,
    );

    let until: string | null = null;
    if (action !== 'warning') {
      const ipExpiry = action === 'ban_24h' ? '+24 hours' : '+30 days';
      db.prepare(
        `INSERT OR REPLACE INTO ip_bans (ip_hash, reason, expires_at) VALUES (?, ?, datetime('now', ?))`,
      ).run(v.ipHash, `auto:${id}`, ipExpiry);
      if (v.userId) {
        if (action === 'ban_24h') {
          db.prepare(`UPDATE users SET banned_until = datetime('now', '+24 hours') WHERE id = ?`).run(v.userId);
        } else {
          db.prepare('UPDATE users SET banned_at = CURRENT_TIMESTAMP WHERE id = ?').run(v.userId);
        }
      }
      if (action === 'ban_24h') {
        until = (db.prepare(`SELECT datetime('now', '+24 hours') AS t`).get() as { t: string }).t;
      }
    }
    return { id, action, until };
  })();
}

/** Anula una detección (falso positivo) y levanta la sanción que aplicó. */
export function overturnViolation(id: number, adminId: number): boolean {
  const v = db.prepare(`SELECT * FROM auto_violations WHERE id = ? AND status = 'active'`).get(id) as
    | { id: number; user_id: number | null; action: AutoAction }
    | undefined;
  if (!v) return false;
  db.transaction(() => {
    db.prepare(
      `UPDATE auto_violations SET status = 'overturned', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).run(adminId, id);
    db.prepare('DELETE FROM ip_bans WHERE reason = ?').run(`auto:${id}`);
    if (v.user_id && v.action === 'ban_24h') db.prepare('UPDATE users SET banned_until = NULL WHERE id = ?').run(v.user_id);
    if (v.user_id && v.action === 'ban_permanent') db.prepare('UPDATE users SET banned_at = NULL WHERE id = ?').run(v.user_id);
  })();
  return true;
}
