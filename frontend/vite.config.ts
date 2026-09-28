import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const backend = 'http://localhost:4000';

/**
 * Content-Security-Policy solo en el build de producción (en dev rompería el HMR de Vite).
 * Solo permite conectar con el propio sitio y con el backend (HTTPS + WSS).
 */
function contentSecurityPolicy(apiUrl: string): Plugin {
  const api = apiUrl ? new URL(apiUrl) : null;
  const connect = api ? `'self' ${api.origin} wss://${api.host}` : `'self'`;
  const csp = [
    `default-src 'self'`,
    `script-src 'self'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data:`,
    `media-src 'self' blob: mediastream:`,
    `connect-src ${connect}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');
  return {
    name: 'friendegle-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiUrl = env.VITE_API_URL ?? '';

  if (mode === 'production' && !apiUrl.startsWith('https://')) {
    const msg = 'VITE_API_URL debe ser la URL https del backend (p. ej. https://api.friendegle.com)';
    // En Vercel es un error fatal; en local solo avisa (npm run build de prueba)
    if (process.env.VERCEL) throw new Error(msg);
    console.warn(`\n⚠️  ${msg}. El build usará /api relativo.\n`);
  }

  return {
    plugins: [react(), tailwindcss(), contentSecurityPolicy(apiUrl)],
    build: {
      target: 'es2022',
      sourcemap: false,
      // simple-peer precompilado pesa ~100 kB: aviso a partir de 600 kB
      chunkSizeWarningLimit: 600,
    },
    server: {
      port: 5173,
      // Mismo origen en desarrollo: el frontend nunca habla directo con otro host
      proxy: {
        '/api': backend,
        '/socket.io': { target: backend, ws: true },
      },
    },
  };
});
