import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from './config.js';
import './database/db.js';
import { rateLimit } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { friendsRouter } from './routes/friends.js';
import { reportsRouter } from './routes/reports.js';
import { adminRouter } from './routes/admin.js';
import { setupVideoSignaling } from './sockets/videoSignaling.js';

const app = express();
app.disable('x-powered-by');
// Detrás de Caddy: req.ip = IP real del cliente (necesario para rate limiting y reportes)
if (config.trustProxy) app.set('trust proxy', 1);
app.use(cors({ origin: config.clientOrigins }));
app.use(express.json({ limit: '20kb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', rateLimit(config.rateLimit.apiPer15Min, 15 * 60 * 1000));
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);

app.use((_req, res) => res.status(404).json({ error: 'No encontrado' }));
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: config.clientOrigins }, maxHttpBufferSize: 64_000 });
setupVideoSignaling(io);

httpServer.listen(config.port, () => {
  console.log(`Friendegle API escuchando en :${config.port} (${config.isProd ? 'producción' : 'desarrollo'})`);
});

// Docker envía SIGTERM al parar/actualizar: cerrar limpio para no dejar la BD a medias
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    io.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
