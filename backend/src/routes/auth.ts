import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, type UserRow } from '../database/db.js';
import { rateLimit, requireAuth, signToken, type AuthedRequest } from '../middleware/auth.js';
import { config } from '../config.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{3,20}$/, 'Usuario: 3-20 caracteres, solo letras, números y _'),
  realName: z.string().trim().max(60).optional(),
  // Confirmación de mayoría de edad (18+) y aceptación de Términos y Política de Privacidad
  acceptTerms: z.literal(true, { message: 'Debes confirmar que tienes 18 años o más y aceptar los términos' }),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

/** Perfil propio: lo único que nunca sale es el hash. */
export const isAdmin = (email: string) => config.adminEmails.includes(email.toLowerCase());

export const BANNED_MESSAGE = 'Tu cuenta está suspendida por incumplir las normas de Friendegle';

export function selfView(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    realName: u.real_name,
    avatarUrl: u.avatar_url,
    bio: u.bio,
    location: u.location,
    streakCount: u.streak_count,
    createdAt: u.created_at,
    isAdmin: isAdmin(u.email),
  };
}

const authLimiter = rateLimit(config.rateLimit.authPer15Min, 15 * 60 * 1000);

authRouter.post('/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { email, password, username, realName } = parsed.data;

  const hash = await bcrypt.hash(password, 12);
  try {
    const info = db
      .prepare(
        'INSERT INTO users (email, password_hash, username, real_name, avatar_url, terms_accepted_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      )
      .run(email, hash, username, realName || null, 'preset:fox');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as UserRow;
    res.status(201).json({ token: signToken(user.id), user: selfView(user) });
  } catch (err: any) {
    if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      // Mensaje genérico: no confirmamos qué email/usuario existe
      return res.status(409).json({ error: 'Ese email o nombre de usuario no está disponible' });
    }
    throw err;
  }
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Email o contraseña inválidos' });
  const { email, password } = parsed.data;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !ok) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  if (user.banned_at) return res.status(403).json({ error: BANNED_MESSAGE });

  res.json({ token: signToken(user.id), user: selfView(user) });
});

authRouter.get('/me', requireAuth, (req: AuthedRequest, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
  if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
  res.json({ user: selfView(user) });
});
