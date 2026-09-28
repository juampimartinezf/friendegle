import { Router } from 'express';
import { z } from 'zod';
import { areFriends, blockUser, db, FRIEND_PROFILE_COLUMNS, type UserRow } from '../database/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { selfView } from './auth.js';
import { notifyUser } from '../sockets/videoSignaling.js';

// PRIVACIDAD: este router NO tiene endpoints de búsqueda ni de listado de usuarios.
// El único perfil ajeno accesible es el de un amigo aceptado.
export const usersRouter = Router();
usersRouter.use(requireAuth);

const profileSchema = z.object({
  realName: z.string().trim().max(60).nullable().optional(),
  // Solo avatares predefinidos: evita URLs arbitrarias (tracking pixels, contenido externo)
  avatarUrl: z.string().regex(/^preset:[a-z]{2,20}$/).optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  location: z.string().trim().max(60).nullable().optional(),
});

usersRouter.put('/me', (req: AuthedRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d = parsed.data;
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow;

  db.prepare('UPDATE users SET real_name = ?, avatar_url = ?, bio = ?, location = ? WHERE id = ?').run(
    d.realName !== undefined ? d.realName || null : current.real_name,
    d.avatarUrl ?? current.avatar_url,
    d.bio !== undefined ? d.bio || null : current.bio,
    d.location !== undefined ? d.location || null : current.location,
    req.userId,
  );
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow;
  res.json({ user: selfView(user) });
});

usersRouter.get('/:id/profile', (req: AuthedRequest, res) => {
  const otherId = Number(req.params.id);
  // 404 (no 403) si no son amigos: no se revela si el usuario existe
  if (!Number.isInteger(otherId) || !areFriends(req.userId!, otherId)) {
    return res.status(404).json({ error: 'Perfil no disponible' });
  }
  const profile = db.prepare(`SELECT ${FRIEND_PROFILE_COLUMNS} FROM users u WHERE u.id = ?`).get(otherId);
  res.json({ profile });
});

usersRouter.post('/:id/block', (req: AuthedRequest, res) => {
  const otherId = Number(req.params.id);
  // Solo se puede bloquear por id a amigos; en el chat se bloquea al compañero actual vía socket
  if (!Number.isInteger(otherId) || !areFriends(req.userId!, otherId)) {
    return res.status(404).json({ error: 'Usuario no disponible' });
  }
  blockUser(req.userId!, otherId);
  notifyUser(otherId, 'friends:changed', {});
  res.json({ ok: true });
});
