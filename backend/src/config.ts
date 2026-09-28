import 'dotenv/config';

// Local: lee backend/.env (dotenv). Producción (Docker): las variables llegan del entorno
// del contenedor (deploy/.env.production) y aquí se validan antes de arrancar.
const env = process.env;
const isProd = env.NODE_ENV === 'production';
const list = (value: string | undefined, fallback: string) =>
  (value ?? fallback).split(',').map((s) => s.trim()).filter(Boolean);

export const config = {
  isProd,
  port: Number(env.PORT ?? 4000),
  // Orígenes permitidos por CORS (separados por comas). Producción: solo tu dominio de Vercel.
  clientOrigins: list(env.CLIENT_ORIGIN, 'http://localhost:5173'),
  // Emails (separados por comas) de las cuentas con acceso al panel de moderación
  adminEmails: list(env.ADMIN_EMAILS, '').map((e) => e.toLowerCase()),
  // '1' cuando hay un reverse proxy delante (Caddy): la IP real sale de X-Forwarded-For
  trustProxy: env.TRUST_PROXY === '1',
  jwtSecret: env.JWT_SECRET ?? 'dev-only-secret-change-me',
  jwtExpiresIn: '7d',
  dbPath: env.DB_PATH ?? './friendegle.db',
  // Usuarios con este número de reportes (de reportantes distintos) en 24h no pueden entrar a la cola
  reportsBeforeSuspension: 3,
  // Un chat cuenta para la racha si dura al menos esto
  minChatSecondsForStreak: 10,
  rateLimit: {
    apiPer15Min: Number(env.RATE_LIMIT_API ?? 600),
    authPer15Min: Number(env.RATE_LIMIT_AUTH ?? 20),
    socketEventsPer10s: Number(env.RATE_LIMIT_SOCKET ?? 120),
  },
  turn: {
    // Separadas por comas. Producción: "turn:turn.tu-dominio.com:3478?transport=udp,turns:turn.tu-dominio.com:5349?transport=tcp"
    urls: list(env.TURN_URLS, 'turn:localhost:3478?transport=udp,turn:localhost:3478?transport=tcp'),
    stunUrl: env.STUN_URL ?? 'stun:stun.l.google.com:19302',
    // Con TURN_SECRET se generan credenciales efímeras (producción); si no, usuario estático (local)
    secret: env.TURN_SECRET || null,
    user: env.TURN_USER ?? 'friendegle',
    pass: env.TURN_PASS ?? 'friendegle123',
    credentialTtlSeconds: 4 * 60 * 60,
  },
};

if (isProd) {
  const errors: string[] = [];
  const requireSecret = (name: string) => {
    const v = env[name];
    if (!v || v.length < 32) errors.push(`${name} es obligatorio y debe tener al menos 32 caracteres (openssl rand -hex 32)`);
  };
  requireSecret('JWT_SECRET');
  requireSecret('TURN_SECRET'); // sin él se usarían credenciales TURN estáticas: relay abierto a cualquiera
  if (!env.CLIENT_ORIGIN) errors.push('CLIENT_ORIGIN es obligatorio (p. ej. https://friendegle.com)');
  for (const origin of config.clientOrigins) {
    if (!origin.startsWith('https://') || origin.includes('*')) errors.push(`CLIENT_ORIGIN debe ser https y sin comodines: ${origin}`);
  }
  if (!env.TURN_URLS || /localhost|127\.0\.0\.1/.test(env.TURN_URLS)) {
    errors.push('TURN_URLS debe apuntar a tu servidor TURN público');
  }
  if (errors.length) {
    throw new Error(`Configuración de producción inválida:\n  - ${errors.join('\n  - ')}`);
  }
}
