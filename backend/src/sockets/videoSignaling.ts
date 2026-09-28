import { createHash, createHmac, randomInt } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { config } from '../config.js';
import { areFriends, blockUser, db, isBlockedEitherWay, isIpBanned, isUserBanned, setOnline } from '../database/db.js';
import { verifyToken } from '../middleware/auth.js';
import { REPORT_REASONS } from '../routes/reports.js';

/**
 * Señalización WebRTC + emparejamiento aleatorio.
 *
 * Reglas de privacidad:
 *  - El cliente NUNCA recibe el id, username ni nombre real del desconocido;
 *    solo una etiqueta anónima (User_XXXX) generada de nuevo en cada chat.
 *  - Solicitudes de amistad, reportes y bloqueos se resuelven en el servidor
 *    a partir del emparejamiento actual.
 */

interface Match {
  a: string;
  b: string;
  labels: Record<string, string>;
  startedAt: number;
}

interface SocketData {
  userId: number | null;
  ipHash: string;
  lastPartnerSocket?: string;
}

let io: Server;
const waiting: string[] = [];
const matches = new Map<string, Match>();
const onlineCount = new Map<number, number>();

const hashIp = (ip: string) => createHash('sha256').update(config.jwtSecret + ip).digest('hex').slice(0, 32);
const newLabel = (avoid?: string) => {
  let label;
  do label = `User_${randomInt(1000, 10000)}`;
  while (label === avoid);
  return label;
};
const dataOf = (s: Socket) => s.data as SocketData;
const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

/**
 * Servidores ICE para un chat. Con TURN_SECRET se usan credenciales efímeras
 * (TURN REST API de coturn: usuario = "caducidad:etiqueta", clave = HMAC-SHA1 en base64),
 * así las credenciales repartidas dejan de valer en unas horas.
 */
function iceServersFor(label: string): RTCIceServerLike[] {
  const { turn } = config;
  let username = turn.user;
  let credential = turn.pass;
  if (turn.secret) {
    username = `${Math.floor(Date.now() / 1000) + turn.credentialTtlSeconds}:${label}`;
    credential = createHmac('sha1', turn.secret).update(username).digest('base64');
  }
  return [
    { urls: turn.stunUrl },
    { urls: turn.urls, username, credential },
  ];
}
type RTCIceServerLike = { urls: string | string[]; username?: string; credential?: string };

const RELAY = /\btyp relay\b/;

/**
 * Defensa en profundidad: aunque el cliente ya usa iceTransportPolicy 'relay',
 * el servidor descarta cualquier candidato que no sea del TURN (host/srflx con IPs reales)
 * antes de reenviarlo al desconocido. Devuelve null si hay que descartar el mensaje.
 */
export function sanitizeSignal(signal: any): unknown | null {
  if (!signal || typeof signal !== 'object') return null;
  if (signal.type === 'candidate') {
    const c = signal.candidate?.candidate;
    if (typeof c !== 'string') return null;
    return c === '' || RELAY.test(c) ? signal : null; // '' = fin de candidatos
  }
  if (typeof signal.sdp === 'string') {
    const sdp = signal.sdp
      .split(/\r?\n/)
      .filter((line: string) => !line.startsWith('a=candidate:') || RELAY.test(line))
      .join('\r\n');
    return { ...signal, sdp };
  }
  return signal; // renegotiate / transceiverRequest: sin direcciones
}

/** Cierra todas las conexiones de un usuario (p. ej. al suspenderlo). */
export function disconnectUser(userId: number) {
  io?.in(`user:${userId}`).disconnectSockets(true);
}

/** Cierra las conexiones anónimas que vienen de una IP suspendida (identificada por su hash). */
export function disconnectIpHash(ipHash: string) {
  for (const socket of io?.sockets.sockets.values() ?? []) {
    if (dataOf(socket).ipHash === ipHash) socket.disconnect(true);
  }
}

/** Envía un evento a todas las pestañas de un usuario registrado. */
export function notifyUser(userId: number, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

function partnerOf(socketId: string): Socket | undefined {
  const m = matches.get(socketId);
  if (!m) return undefined;
  return io.sockets.sockets.get(m.a === socketId ? m.b : m.a);
}

function isSuspended(d: SocketData): boolean {
  // Suspensión permanente decidida por un moderador
  if ((d.userId && isUserBanned(d.userId)) || isIpBanned(d.ipHash)) return true;
  const since = new Date(Date.now() - 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT COALESCE('u' || reporting_user_id, 'ip' || reporting_ip)) AS n
       FROM reports WHERE created_at >= ? AND (reported_user_id = ? OR (reported_user_id IS NULL AND reported_ip = ?))`,
    )
    .get(since, d.userId ?? -1, d.ipHash) as { n: number };
  return row.n >= config.reportsBeforeSuspension;
}

function canPair(x: Socket, y: Socket): boolean {
  const dx = dataOf(x);
  const dy = dataOf(y);
  if (x.id === y.id) return false;
  // Evita reemparejar inmediatamente con quien acabas de saltar
  if (dx.lastPartnerSocket === y.id || dy.lastPartnerSocket === x.id) return false;
  if (dx.userId && dy.userId) {
    if (dx.userId === dy.userId) return false; // misma cuenta en dos pestañas
    if (isBlockedEitherWay(dx.userId, dy.userId)) return false;
  }
  return true;
}

function removeFromQueue(socketId: string) {
  const i = waiting.indexOf(socketId);
  if (i !== -1) waiting.splice(i, 1);
}

function updateStreak(userId: number) {
  const u = db.prepare('SELECT streak_count, last_chat_date FROM users WHERE id = ?').get(userId) as
    | { streak_count: number; last_chat_date: string | null }
    | undefined;
  if (!u || u.last_chat_date === today()) return;
  const streak = u.last_chat_date === yesterday() ? u.streak_count + 1 : 1;
  db.prepare('UPDATE users SET streak_count = ?, last_chat_date = ? WHERE id = ?').run(streak, today(), userId);
}

function endMatch(socketId: string, reasonForPartner: 'partner_left' | 'partner_disconnected' | 'reported') {
  const m = matches.get(socketId);
  if (!m) return;
  matches.delete(m.a);
  matches.delete(m.b);

  const sa = io.sockets.sockets.get(m.a);
  const sb = io.sockets.sockets.get(m.b);
  if (sa) dataOf(sa).lastPartnerSocket = m.b;
  if (sb) dataOf(sb).lastPartnerSocket = m.a;

  const partner = m.a === socketId ? sb : sa;
  partner?.emit('chat:ended', { reason: reasonForPartner });

  // Historial y rachas (solo usuarios registrados)
  const seconds = Math.round((Date.now() - m.startedAt) / 1000);
  const ua = sa ? dataOf(sa).userId : null;
  const ub = sb ? dataOf(sb).userId : null;
  if (ua && ub) {
    const friends = areFriends(ua, ub);
    db.prepare('INSERT INTO chats (user1_id, user2_id, duration_seconds, was_friends) VALUES (?, ?, ?, ?)').run(
      ua,
      ub,
      seconds,
      friends ? 1 : 0,
    );
    if (friends) {
      db.prepare(
        `UPDATE friends SET last_chat_at = CURRENT_TIMESTAMP
         WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
      ).run(ua, ub, ub, ua);
    }
  }
  if (seconds >= config.minChatSecondsForStreak) {
    if (ua) updateStreak(ua);
    if (ub) updateStreak(ub);
  }
}

function tryMatch(socket: Socket) {
  for (let i = 0; i < waiting.length; i++) {
    const other = io.sockets.sockets.get(waiting[i]);
    if (!other) {
      waiting.splice(i--, 1);
      continue;
    }
    if (!canPair(socket, other)) continue;
    waiting.splice(i, 1);

    const labelA = newLabel();
    const labelB = newLabel(labelA);
    const m: Match = { a: other.id, b: socket.id, labels: { [other.id]: labelA, [socket.id]: labelB }, startedAt: Date.now() };
    matches.set(other.id, m);
    matches.set(socket.id, m);

    const aReg = !!dataOf(other).userId;
    const bReg = !!dataOf(socket).userId;
    // `canAddFriend` solo es true si AMBOS tienen cuenta
    const canAddFriend = aReg && bReg;
    other.emit('chat:matched', { myLabel: labelA, partnerLabel: labelB, initiator: true, canAddFriend, iceServers: iceServersFor(labelA) });
    socket.emit('chat:matched', { myLabel: labelB, partnerLabel: labelA, initiator: false, canAddFriend, iceServers: iceServersFor(labelB) });
    return;
  }
  waiting.push(socket.id);
  socket.emit('queue:waiting');
}

function handleAddFriend(socket: Socket) {
  const m = matches.get(socket.id);
  const partner = partnerOf(socket.id);
  const me = dataOf(socket).userId;
  const them = partner ? dataOf(partner).userId : null;
  if (!m || !partner || !me || !them) {
    return socket.emit('friend:status', { state: 'unavailable' });
  }
  if (isBlockedEitherWay(me, them)) return socket.emit('friend:status', { state: 'unavailable' });
  if (areFriends(me, them)) return socket.emit('friend:status', { state: 'already' });

  const reverse = db
    .prepare(`SELECT id FROM friends WHERE user1_id = ? AND user2_id = ? AND status = 'pending'`)
    .get(them, me) as { id: number } | undefined;

  if (reverse) {
    // Ambos quieren ser amigos: se acepta directamente
    db.prepare(`UPDATE friends SET status = 'accepted' WHERE id = ?`).run(reverse.id);
    socket.emit('friend:status', { state: 'accepted' });
    partner.emit('friend:status', { state: 'accepted' });
    notifyUser(me, 'friends:changed', {});
    notifyUser(them, 'friend:accepted', {});
    return;
  }

  db.prepare(`INSERT OR IGNORE INTO friends (user1_id, user2_id, status, request_label) VALUES (?, ?, 'pending', ?)`).run(
    me,
    them,
    m.labels[socket.id],
  );
  socket.emit('friend:status', { state: 'sent' });
  partner.emit('friend:incoming', { from: m.labels[socket.id] });
  notifyUser(them, 'friend:request', {});
}

function handleReport(socket: Socket, payload: unknown) {
  const reason = (payload as { reason?: string })?.reason;
  if (!REPORT_REASONS.includes(reason as (typeof REPORT_REASONS)[number])) return;
  const m = matches.get(socket.id);
  const partner = partnerOf(socket.id);
  if (!m || !partner) return;

  const me = dataOf(socket);
  const them = dataOf(partner);
  db.prepare(
    `INSERT INTO reports (reported_user_id, reporting_user_id, reported_label, reported_ip, reporting_ip, reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(them.userId, me.userId, m.labels[partner.id], them.ipHash, me.ipHash, reason);

  // Reportar también bloquea (si ambos tienen cuenta) para no volver a coincidir
  if (me.userId && them.userId) blockUser(me.userId, them.userId);

  endMatch(socket.id, 'reported');
  socket.emit('report:ok');
}

function handleBlock(socket: Socket) {
  const partner = partnerOf(socket.id);
  const me = dataOf(socket).userId;
  const them = partner ? dataOf(partner).userId : null;
  if (me && them) blockUser(me, them);
  // Con anónimos no hay cuenta que bloquear, pero al menos no se reemparejan enseguida
  endMatch(socket.id, 'partner_left');
  socket.emit('block:ok');
}

/** IP real del cliente. Detrás de Caddy (TRUST_PROXY=1) viene en X-Forwarded-For. */
function clientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (config.trustProxy && typeof forwarded === 'string') {
    return forwarded.split(',').at(-1)!.trim();
  }
  return socket.handshake.address;
}

export function setupVideoSignaling(server: Server) {
  io = server;

  io.on('connection', (socket) => {
    const userId = verifyToken(socket.handshake.auth?.token);
    const data = dataOf(socket);
    data.userId = userId;
    data.ipHash = hashIp(clientIp(socket));

    // Rate limit por conexión: quien inunda de eventos (skip en bucle, spam de señales) se desconecta
    let windowStart = Date.now();
    let events = 0;
    socket.use((_packet, next) => {
      const now = Date.now();
      if (now - windowStart > 10_000) {
        windowStart = now;
        events = 0;
      }
      if (++events > config.rateLimit.socketEventsPer10s) return socket.disconnect(true);
      next();
    });

    if (userId) {
      socket.join(`user:${userId}`);
      onlineCount.set(userId, (onlineCount.get(userId) ?? 0) + 1);
      setOnline(userId, true);
    }

    socket.on('queue:join', () => {
      if (isSuspended(data)) return socket.emit('queue:suspended');
      endMatch(socket.id, 'partner_left');
      removeFromQueue(socket.id);
      tryMatch(socket);
    });

    socket.on('queue:leave', () => removeFromQueue(socket.id));

    socket.on('signal', (signal: unknown) => {
      // Reenvía SDP/ICE solo al compañero actual; limita tamaño para evitar abuso
      if (JSON.stringify(signal ?? null).length > 20_000) return;
      const clean = sanitizeSignal(signal);
      if (clean) partnerOf(socket.id)?.emit('signal', clean);
    });

    socket.on('chat:leave', () => {
      removeFromQueue(socket.id);
      endMatch(socket.id, 'partner_left');
    });

    socket.on('chat:add-friend', () => handleAddFriend(socket));
    socket.on('chat:report', (p) => handleReport(socket, p));
    socket.on('chat:block', () => handleBlock(socket));

    socket.on('disconnect', () => {
      removeFromQueue(socket.id);
      endMatch(socket.id, 'partner_disconnected');
      if (userId) {
        const n = (onlineCount.get(userId) ?? 1) - 1;
        if (n <= 0) {
          onlineCount.delete(userId);
          setOnline(userId, false);
        } else onlineCount.set(userId, n);
      }
    });
  });
}
