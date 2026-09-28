import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const backend = 'http://localhost:4000';

/**
 * Analítica sin cookies, opcional. Plausible: VITE_PLAUSIBLE_DOMAIN (+ VITE_PLAUSIBLE_SRC si es autoalojado).
 * Umami: VITE_UMAMI_WEBSITE_ID (+ VITE_UMAMI_SRC si es autoalojado). Solo en el build de producción.
 */
function analytics(env: Record<string, string>): { tag: string; scriptOrigin: string; connect: string[] } | null {
  const escape = (v: string) => v.replace(/[^\w.:/@-]/g, '');
  if (env.VITE_PLAUSIBLE_DOMAIN) {
    const src = env.VITE_PLAUSIBLE_SRC || 'https://plausible.io/js/script.js';
    const origin = new URL(src).origin;
    // Plausible espera solo el dominio: se toleran "https://…" o una barra final pegados por error
    const domain = env.VITE_PLAUSIBLE_DOMAIN.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return { tag: `<script defer data-domain="${escape(domain)}" src="${escape(src)}"></script>`, scriptOrigin: origin, connect: [origin] };
  }
  if (env.VITE_UMAMI_WEBSITE_ID) {
    const src = env.VITE_UMAMI_SRC || 'https://cloud.umami.is/script.js';
    const origin = new URL(src).origin;
    // Umami Cloud sirve el script desde cloud.umami.is pero envía los eventos a gateway.umami.is
    const connect = origin === 'https://cloud.umami.is' ? [origin, 'https://gateway.umami.is'] : [origin];
    return { tag: `<script defer data-website-id="${escape(env.VITE_UMAMI_WEBSITE_ID)}" src="${escape(src)}"></script>`, scriptOrigin: origin, connect };
  }
  return null;
}

/**
 * Content-Security-Policy solo en el build de producción (en dev rompería el HMR de Vite).
 * Solo permite conectar con el propio sitio, con el backend (HTTPS + WSS) y, si está configurada, con la analítica.
 */
function contentSecurityPolicy(apiUrl: string, stats: ReturnType<typeof analytics>): Plugin {
  const api = apiUrl ? new URL(apiUrl) : null;
  const connect = [`'self'`, ...(api ? [api.origin, `wss://${api.host}`] : []), ...(stats?.connect ?? [])].join(' ');
  const csp = [
    `default-src 'self'`,
    `script-src 'self'${stats ? ` ${stats.scriptOrigin}` : ''}`,
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
      html
        .replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`)
        .replace('</head>', stats ? `  ${stats.tag}\n  </head>` : '</head>'),
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

  const missingLegal = ['VITE_LEGAL_OWNER', 'VITE_CONTACT_EMAIL', 'VITE_LEGAL_COUNTRY'].filter((k) => !env[k]);
  if (mode === 'production' && missingLegal.length) {
    const msg = `Faltan ${missingLegal.join(', ')}: las páginas de Términos y Privacidad mostrarían huecos sin rellenar`;
    if (process.env.VERCEL) throw new Error(msg);
    console.warn(`\n⚠️  ${msg}.\n`);
  }

  const stats = analytics(env);
  // Visible en los logs de build de Vercel: confirma si la analítica quedó incluida
  if (mode === 'production') {
    console.log(stats ? `\n📊 Analítica incluida: ${stats.tag}\n` : '\n📊 Sin analítica (VITE_PLAUSIBLE_DOMAIN / VITE_UMAMI_WEBSITE_ID vacías)\n');
  }

  return {
    plugins: [react(), tailwindcss(), contentSecurityPolicy(apiUrl, stats)],
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
