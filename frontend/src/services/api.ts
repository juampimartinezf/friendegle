const TOKEN_KEY = 'friendegle_token';

/**
 * URL del backend. Vacía en local: las peticiones van a /api y el proxy de Vite las reenvía.
 * En producción (Vercel) es la URL pública del backend, p. ej. https://api.friendegle.com
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export interface Me {
  id: number;
  email: string;
  username: string;
  realName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  streakCount: number;
  createdAt: string;
  isAdmin: boolean;
}

export interface Friend {
  friendshipId: number;
  id: number;
  username: string;
  realName: string | null;
  avatarUrl: string | null;
  isOnline: number;
  lastSeen: string | null;
}

export interface FriendProfile {
  id: number;
  username: string;
  real_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  is_online: number;
  last_seen: string | null;
  streak_count: number;
}

export interface AdminReport {
  id: number;
  reason: string;
  status: 'open' | 'dismissed' | 'actioned';
  createdAt: string;
  reportedLabel: string | null;
  reportedUserId: number | null;
  reportedUsername: string | null;
  reporterUsername: string | null;
  isBanned: number;
  totalReports: number;
}

export interface DirectMessage {
  id: number;
  senderId: number;
  recipientId: number;
  body: string;
  readAt: string | null;
  createdAt: string;
  /** Solo en la notificación que recibe el destinatario */
  senderName?: string;
}

export interface Conversation {
  friendId: number;
  username: string;
  realName: string | null;
  avatarUrl: string | null;
  isOnline: number;
  lastBody: string | null;
  lastSenderId: number | null;
  lastAt: string | null;
  unread: number;
}

export const MAX_DM_LENGTH = 1000;

export interface AutoViolation {
  id: number;
  category: 'porn' | 'hentai';
  score: number;
  action: 'warning' | 'ban_24h' | 'ban_permanent';
  status: 'active' | 'overturned';
  label: string | null;
  createdAt: string;
  userId: number | null;
  username: string | null;
  reporterUsername: string | null;
  activeViolations: number;
  isBanned: number;
}

export interface FriendRequest {
  id: number;
  label: string;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? 'Error de red');
  return body as T;
}

const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined });

export const api = {
  register: (data: { email: string; password: string; username: string; realName?: string; acceptTerms: true }) =>
    post<{ token: string; user: Me }>('/auth/register', data),
  login: (data: { email: string; password: string }) => post<{ token: string; user: Me }>('/auth/login', data),
  me: () => request<{ user: Me }>('/auth/me'),

  updateProfile: (data: Partial<Pick<Me, 'realName' | 'avatarUrl' | 'bio' | 'location'>>) =>
    request<{ user: Me }>('/users/me', { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (password: string) =>
    request<{ ok: true }>('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) }),
  friendProfile: (id: number) => request<{ profile: FriendProfile }>(`/users/${id}/profile`),
  blockFriend: (id: number) => post<{ ok: true }>(`/users/${id}/block`),

  friends: () => request<{ friends: Friend[] }>('/friends'),
  friendRequests: () => request<{ incoming: FriendRequest[]; outgoingCount: number }>('/friends/requests'),
  acceptRequest: (id: number) => post<{ ok: true }>(`/friends/${id}/accept`),
  rejectRequest: (id: number) => post<{ ok: true }>(`/friends/${id}/reject`),
  removeFriend: (id: number) => request<{ ok: true }>(`/friends/${id}`, { method: 'DELETE' }),

  reportFriend: (userId: number, reason: string, details?: string) =>
    post<{ ok: true }>('/reports', { userId, reason, details }),

  conversations: () => request<{ conversations: Conversation[] }>('/messages/conversations'),
  directMessages: (friendId: number) => request<{ messages: DirectMessage[] }>(`/messages/${friendId}`),
  sendDirectMessage: (friendId: number, body: string) => post<{ message: DirectMessage }>(`/messages/${friendId}`, { body }),
  markConversationRead: (friendId: number) => post<{ ok: true }>(`/messages/${friendId}/read`),

  adminReports: (status: AdminReport['status']) => request<{ reports: AdminReport[] }>(`/admin/reports?status=${status}`),
  adminDismiss: (id: number) => post<{ ok: true }>(`/admin/reports/${id}/dismiss`),
  adminBan: (id: number) => post<{ ok: true }>(`/admin/reports/${id}/ban`),
  adminViolations: (status: AutoViolation['status']) => request<{ violations: AutoViolation[] }>(`/admin/violations?status=${status}`),
  adminOverturn: (id: number) => post<{ ok: true }>(`/admin/violations/${id}/overturn`),
};

/** SQLite guarda CURRENT_TIMESTAMP en UTC sin zona: "2026-09-27 21:03:11" */
export function parseDbDate(s: string | null): Date | null {
  return s ? new Date(s.replace(' ', 'T') + 'Z') : null;
}

export function formatLastSeen(isOnline: number | boolean, lastSeen: string | null): string {
  if (isOnline) return 'En línea';
  const d = parseDbDate(lastSeen);
  if (!d) return 'Nunca';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Ayer' : `Hace ${days} días`;
}

export const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'nudity', label: 'Desnudez o contenido sexual' },
  { value: 'minor', label: 'Parece menor de edad' },
  { value: 'harassment', label: 'Acoso o intimidación' },
  { value: 'hate', label: 'Odio o discriminación' },
  { value: 'violence', label: 'Violencia o amenazas' },
  { value: 'spam', label: 'Spam o publicidad' },
  { value: 'other', label: 'Otro' },
];
