import { Router } from 'express';
import { db } from '../database/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { notifyNewFriends, notifyUser } from '../sockets/videoSignaling.js';
import { withStreak, type StreakState } from '../streaks.js';

// Las solicitudes de amistad se ENVÍAN solo desde un chat en curso (evento de socket
// `chat:add-friend`), así el cliente nunca conoce el id real del desconocido.
// Aquí solo se listan, aceptan, rechazan y eliminan.
export const friendsRouter = Router();
friendsRouter.use(requireAuth);

interface FriendRow {
  id: number;
  user1_id: number;
  user2_id: number;
  status: string;
}

function getRow(id: number) {
  return db.prepare('SELECT * FROM friends WHERE id = ?').get(id) as FriendRow | undefined;
}

friendsRouter.get('/', (req: AuthedRequest, res) => {
  const friends = db
    .prepare(
      `SELECT f.id AS friendshipId, u.id, u.username, u.real_name AS realName, u.avatar_url AS avatarUrl,
              u.is_online AS isOnline, u.last_seen AS lastSeen,
              f.streak_count, f.last_streak_day, f.streak_broken_at, f.recovery_attempts
       FROM friends f
       JOIN users u ON u.id = CASE WHEN f.user1_id = ? THEN f.user2_id ELSE f.user1_id END
       WHERE f.status = 'accepted' AND (f.user1_id = ? OR f.user2_id = ?)
       ORDER BY u.is_online DESC, u.last_seen DESC`,
    )
    .all(req.userId, req.userId, req.userId) as StreakState[];
  res.json({ friends: friends.map(withStreak) });
});

friendsRouter.get('/requests', (req: AuthedRequest, res) => {
  // Solicitudes recibidas: solo se muestra el nombre anónimo del chat, NUNCA el perfil real
  const incoming = db
    .prepare(
      `SELECT id, request_label AS label, created_at AS createdAt
       FROM friends WHERE user2_id = ? AND status = 'pending' ORDER BY created_at DESC`,
    )
    .all(req.userId);
  const { outgoing } = db
    .prepare(`SELECT COUNT(*) AS outgoing FROM friends WHERE user1_id = ? AND status = 'pending'`)
    .get(req.userId) as { outgoing: number };
  res.json({ incoming, outgoingCount: outgoing });
});

friendsRouter.post('/:id/accept', (req: AuthedRequest, res) => {
  const row = getRow(Number(req.params.id));
  if (!row || row.user2_id !== req.userId || row.status !== 'pending') {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }
  db.prepare(`UPDATE friends SET status = 'accepted' WHERE id = ?`).run(row.id);
  notifyUser(row.user1_id, 'friend:accepted', {});
  notifyNewFriends(row.user1_id, row.user2_id);
  res.json({ ok: true });
});

friendsRouter.post('/:id/reject', (req: AuthedRequest, res) => {
  const row = getRow(Number(req.params.id));
  if (!row || row.user2_id !== req.userId || row.status !== 'pending') {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }
  // Se borra en silencio: el solicitante no recibe notificación de rechazo
  db.prepare('DELETE FROM friends WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

friendsRouter.delete('/:id', (req: AuthedRequest, res) => {
  const row = getRow(Number(req.params.id));
  if (!row || (row.user1_id !== req.userId && row.user2_id !== req.userId)) {
    return res.status(404).json({ error: 'Amistad no encontrada' });
  }
  db.prepare('DELETE FROM friends WHERE id = ?').run(row.id);
  notifyUser(row.user1_id === req.userId ? row.user2_id : row.user1_id, 'friends:changed', {});
  res.json({ ok: true });
});
