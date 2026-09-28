import { Router } from 'express';
import { z } from 'zod';
import { areFriends, db } from '../database/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

// Reportes a AMIGOS (desde su perfil). Los reportes durante un chat van por socket
// (`chat:report`) porque el cliente no conoce la identidad del desconocido.
export const reportsRouter = Router();
reportsRouter.use(requireAuth);

export const REPORT_REASONS = ['nudity', 'harassment', 'minor', 'spam', 'hate', 'violence', 'other'] as const;

const schema = z.object({
  userId: z.number().int(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(500).optional(),
});

reportsRouter.post('/', (req: AuthedRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Reporte inválido' });
  const { userId, reason, details } = parsed.data;
  if (!areFriends(req.userId!, userId)) return res.status(404).json({ error: 'Usuario no disponible' });

  db.prepare('INSERT INTO reports (reported_user_id, reporting_user_id, reason) VALUES (?, ?, ?)').run(
    userId,
    req.userId,
    details ? `${reason}: ${details}` : reason,
  );
  res.status(201).json({ ok: true });
});
