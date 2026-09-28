import { Router } from 'express';
import { z } from 'zod';
import { areFriends, db, isBlockedEitherWay } from '../database/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { notifyUser } from '../sockets/videoSignaling.js';
import { bothMessagedToday, recordFriendChatDay, withStreak, type StreakState } from '../streaks.js';

// Mensajes privados de texto entre amigos aceptados (fuera del videochat).
// Solo se puede leer o escribir una conversación mientras sois amigos y nadie ha bloqueado al otro.
export const messagesRouter = Router();
messagesRouter.use(requireAuth);

export const MAX_DM_LENGTH = 1000;
const HISTORY_LIMIT = 200;

interface DmRow {
  id: number;
  sender_id: number;
  recipient_id: number;
  body: string;
  read_at: string | null;
  created_at: string;
}

const view = (m: DmRow) => ({
  id: m.id,
  senderId: m.sender_id,
  recipientId: m.recipient_id,
  body: m.body,
  readAt: m.read_at,
  createdAt: m.created_at,
});

function friendOr404(req: AuthedRequest): number | null {
  const friendId = Number(req.params.friendId);
  if (!Number.isInteger(friendId) || !areFriends(req.userId!, friendId) || isBlockedEitherWay(req.userId!, friendId)) {
    return null;
  }
  return friendId;
}

/** Todas las conversaciones posibles (una por amigo), con el último mensaje y los no leídos. */
messagesRouter.get('/conversations', (req: AuthedRequest, res) => {
  const me = req.userId;
  const conversations = db
    .prepare(
      `SELECT u.id AS friendId, u.username, u.real_name AS realName, u.avatar_url AS avatarUrl, u.is_online AS isOnline,
              last.body AS lastBody, last.sender_id AS lastSenderId, last.created_at AS lastAt,
              f.streak_count, f.last_streak_day, f.streak_broken_at, f.recovery_attempts,
              (SELECT COUNT(*) FROM direct_messages
                WHERE sender_id = u.id AND recipient_id = :me AND read_at IS NULL) AS unread
       FROM friends f
       JOIN users u ON u.id = CASE WHEN f.user1_id = :me THEN f.user2_id ELSE f.user1_id END
       LEFT JOIN direct_messages last ON last.id = (
         SELECT MAX(id) FROM direct_messages
         WHERE (sender_id = :me AND recipient_id = u.id) OR (sender_id = u.id AND recipient_id = :me)
       )
       WHERE f.status = 'accepted' AND (f.user1_id = :me OR f.user2_id = :me)
       ORDER BY last.id IS NULL, last.id DESC, u.username`,
    )
    .all({ me }) as StreakState[];
  res.json({ conversations: conversations.map(withStreak) });
});

/** Últimos mensajes de una conversación, del más antiguo al más reciente. */
messagesRouter.get('/:friendId', (req: AuthedRequest, res) => {
  const friendId = friendOr404(req);
  if (!friendId) return res.status(404).json({ error: 'Conversación no disponible' });
  const rows = db
    .prepare(
      `SELECT * FROM direct_messages
       WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
       ORDER BY id DESC LIMIT ?`,
    )
    .all(req.userId, friendId, friendId, req.userId, HISTORY_LIMIT) as DmRow[];
  res.json({ messages: rows.reverse().map(view) });
});

const sendSchema = z.object({ body: z.string().trim().min(1).max(MAX_DM_LENGTH) });

messagesRouter.post('/:friendId', (req: AuthedRequest, res) => {
  const friendId = friendOr404(req);
  if (!friendId) return res.status(404).json({ error: 'Conversación no disponible' });
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: `El mensaje debe tener entre 1 y ${MAX_DM_LENGTH} caracteres` });

  const info = db
    .prepare('INSERT INTO direct_messages (sender_id, recipient_id, body) VALUES (?, ?, ?)')
    .run(req.userId, friendId, parsed.data.body);
  const message = view(db.prepare('SELECT * FROM direct_messages WHERE id = ?').get(info.lastInsertRowid) as DmRow);
  const sender = db.prepare('SELECT username, real_name FROM users WHERE id = ?').get(req.userId) as {
    username: string;
    real_name: string | null;
  };

  // Tiempo real: al amigo (notificación) y a las otras pestañas del remitente
  notifyUser(friendId, 'dm:new', { ...message, senderName: sender.real_name || sender.username });
  notifyUser(req.userId!, 'dm:new', message);
  // Racha: el día cuenta cuando los DOS se escribieron hoy
  if (bothMessagedToday(req.userId!, friendId) && recordFriendChatDay(req.userId!, friendId)) {
    notifyUser(friendId, 'streak:update', {});
    notifyUser(req.userId!, 'streak:update', {});
  }
  res.status(201).json({ message });
});

/** Marca como leídos los mensajes recibidos de ese amigo. */
messagesRouter.post('/:friendId/read', (req: AuthedRequest, res) => {
  const friendId = friendOr404(req);
  if (!friendId) return res.status(404).json({ error: 'Conversación no disponible' });
  db.prepare(
    `UPDATE direct_messages SET read_at = CURRENT_TIMESTAMP
     WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL`,
  ).run(friendId, req.userId);
  notifyUser(req.userId!, 'dm:read', { friendId }); // mis pestañas: actualizar contador
  notifyUser(friendId, 'dm:read', { friendId: req.userId }); // el remitente: mostrar "Leído"
  res.json({ ok: true });
});
