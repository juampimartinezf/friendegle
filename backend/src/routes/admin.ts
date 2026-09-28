import { Router, type NextFunction, type Response } from 'express';
import { db } from '../database/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { disconnectIpHash, disconnectUser } from '../sockets/videoSignaling.js';
import { isAdmin } from './auth.js';
import { overturnViolation } from '../autoModeration.js';

// Panel de moderación. Solo para cuentas cuyo email está en ADMIN_EMAILS.
// Muestra lo necesario para decidir (motivo, etiqueta del chat, cuenta reportada, nº de reportes);
// nunca IPs: los anónimos se identifican solo por un hash.
export const adminRouter = Router();

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.userId) as { email: string } | undefined;
  // 404 en vez de 403: no revelar que existe un panel de administración
  if (!user || !isAdmin(user.email)) return res.status(404).json({ error: 'No encontrado' });
  next();
}
adminRouter.use(requireAuth, requireAdmin);

interface ReportRow {
  id: number;
  reported_user_id: number | null;
  reported_ip: string | null;
}

adminRouter.get('/reports', (req, res) => {
  const status = ['open', 'dismissed', 'actioned'].includes(String(req.query.status)) ? String(req.query.status) : 'open';
  const reports = db
    .prepare(
      `SELECT r.id, r.reason, r.status, r.created_at AS createdAt, r.reported_label AS reportedLabel,
              r.reported_user_id AS reportedUserId, u.username AS reportedUsername,
              (u.banned_at IS NOT NULL OR b.ip_hash IS NOT NULL) AS isBanned,
              reporter.username AS reporterUsername,
              (SELECT COUNT(*) FROM reports r2
                WHERE (r.reported_user_id IS NOT NULL AND r2.reported_user_id = r.reported_user_id)
                   OR (r.reported_user_id IS NULL AND r2.reported_user_id IS NULL AND r2.reported_ip = r.reported_ip)
              ) AS totalReports
       FROM reports r
       LEFT JOIN users u ON u.id = r.reported_user_id
       LEFT JOIN users reporter ON reporter.id = r.reporting_user_id
       LEFT JOIN ip_bans b ON r.reported_user_id IS NULL AND b.ip_hash = r.reported_ip
       WHERE COALESCE(r.status, 'open') = ?
       ORDER BY (r.reason = 'minor') DESC, r.created_at DESC
       LIMIT 200`,
    )
    .all(status);
  res.json({ reports });
});

function getReport(id: number) {
  return db.prepare('SELECT id, reported_user_id, reported_ip FROM reports WHERE id = ?').get(id) as ReportRow | undefined;
}

adminRouter.post('/reports/:id/dismiss', (req: AuthedRequest, res) => {
  const report = getReport(Number(req.params.id));
  if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });
  db.prepare(`UPDATE reports SET status = 'dismissed', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE id = ?`).run(
    req.userId,
    report.id,
  );
  res.json({ ok: true });
});

/** Suspende al reportado (cuenta o, si era anónimo, su IP) y cierra todos sus reportes abiertos. */
adminRouter.post('/reports/:id/ban', (req: AuthedRequest, res) => {
  const report = getReport(Number(req.params.id));
  if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });

  db.transaction(() => {
    if (report.reported_user_id) {
      db.prepare('UPDATE users SET banned_at = CURRENT_TIMESTAMP WHERE id = ?').run(report.reported_user_id);
      db.prepare(
        `UPDATE reports SET status = 'actioned', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?
         WHERE reported_user_id = ? AND COALESCE(status, 'open') = 'open'`,
      ).run(req.userId, report.reported_user_id);
    } else if (report.reported_ip) {
      db.prepare(`INSERT OR IGNORE INTO ip_bans (ip_hash, reason) VALUES (?, 'moderation')`).run(report.reported_ip);
      db.prepare(
        `UPDATE reports SET status = 'actioned', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?
         WHERE reported_user_id IS NULL AND reported_ip = ? AND COALESCE(status, 'open') = 'open'`,
      ).run(req.userId, report.reported_ip);
    }
  })();

  if (report.reported_user_id) disconnectUser(report.reported_user_id);
  else if (report.reported_ip) disconnectIpHash(report.reported_ip);
  res.json({ ok: true });
});

// ---------- Detecciones automáticas de contenido sexual ----------

adminRouter.get('/violations', (req, res) => {
  const status = req.query.status === 'overturned' ? 'overturned' : 'active';
  const violations = db
    .prepare(
      `SELECT v.id, v.category, v.score, v.action, v.status, v.label, v.created_at AS createdAt,
              v.user_id AS userId, u.username,
              reporter.username AS reporterUsername,
              (SELECT COUNT(*) FROM auto_violations v2
                WHERE v2.status = 'active' AND (v2.ip_hash = v.ip_hash OR (v.user_id IS NOT NULL AND v2.user_id = v.user_id))
              ) AS activeViolations,
              (u.banned_at IS NOT NULL OR u.banned_until > datetime('now')
                OR EXISTS (SELECT 1 FROM ip_bans b WHERE b.ip_hash = v.ip_hash AND (b.expires_at IS NULL OR b.expires_at > datetime('now')))
              ) AS isBanned
       FROM auto_violations v
       LEFT JOIN users u ON u.id = v.user_id
       LEFT JOIN users reporter ON reporter.id = v.reporter_user_id
       WHERE v.status = ?
       ORDER BY v.created_at DESC
       LIMIT 200`,
    )
    .all(status);
  res.json({ violations });
});

/** Falso positivo: anula la detección y levanta el ban que causó. */
adminRouter.post('/violations/:id/overturn', (req: AuthedRequest, res) => {
  if (!overturnViolation(Number(req.params.id), req.userId!)) {
    return res.status(404).json({ error: 'Detección no encontrada o ya anulada' });
  }
  res.json({ ok: true });
});
