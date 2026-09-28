/**
 * Analítica sin cookies (Plausible o Umami). El script solo se incluye en el build si se configuró
 * VITE_PLAUSIBLE_DOMAIN o VITE_UMAMI_WEBSITE_ID (ver vite.config.ts); si no, track() no hace nada.
 * Nunca se envían datos personales: solo el nombre del evento y, como mucho, un sí/no.
 */
declare global {
  interface Window {
    plausible?: (event: string, options?: { props: Record<string, string | boolean> }) => void;
    umami?: { track: (event: string, data?: Record<string, string | boolean>) => void };
  }
}

export const analyticsEnabled = !!(import.meta.env.VITE_PLAUSIBLE_DOMAIN || import.meta.env.VITE_UMAMI_WEBSITE_ID);

export function track(event: string, props?: Record<string, string | boolean>) {
  try {
    window.plausible?.(event, props && { props });
    window.umami?.track(event, props);
  } catch {
    // la analítica nunca debe romper la app (p. ej. bloqueada por el navegador)
  }
}
