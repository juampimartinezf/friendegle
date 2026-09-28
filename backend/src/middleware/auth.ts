import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { isUserBanned } from '../database/db.js';

export interface AuthedRequest extends Request {
  userId?: number;
}

export function signToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
}

/** Devuelve el id de usuario si el token es válido, o null. */
export function verifyToken(token: string | undefined | null): number | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    const id = Number(payload.sub);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const userId = verifyToken(header?.startsWith('Bearer ') ? header.slice(7) : null);
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  // Una cuenta suspendida pierde el acceso aunque su token siga siendo válido
  if (isUserBanned(userId)) return res.status(403).json({ error: 'Cuenta suspendida' });
  req.userId = userId;
  next();
}

/** Limitador en memoria muy simple (suficiente para un MVP de un solo proceso). */
export function rateLimit(maxRequests: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  // Limpia entradas caducadas para que el mapa no crezca sin límite
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt < now) hits.delete(key);
  }, windowMs).unref();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (++entry.count > maxRequests) {
      return res.status(429).json({ error: 'Demasiados intentos, espera un momento' });
    }
    next();
  };
}
