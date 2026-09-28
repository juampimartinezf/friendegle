/**
 * Detección local de contenido sexual en el vídeo que RECIBES (el del otro usuario).
 *
 * - Modelo: NSFWJS MobileNetV2 (TensorFlow.js), incluido en el bundle: no hay peticiones externas.
 * - Se analiza un fotograma por segundo en memoria. Los fotogramas nunca se guardan ni se envían:
 *   al servidor solo llega la categoría y la confianza cuando hay una detección.
 * - Para evitar falsos positivos hace falta una detección sostenida (3 fotogramas seguidos).
 *   La clase "Sexy" (bañadores, torsos desnudos…) no se sanciona a propósito.
 * - Todo se carga bajo demanda (chunk aparte): el resto de la app no paga el peso de TensorFlow.
 */
import type { NSFWJS } from 'nsfwjs/core';

export type NsfwCategory = 'porn' | 'hentai';

const THRESHOLDS: Record<NsfwCategory, number> = { porn: 0.75, hentai: 0.85 };
const CLASS: Record<NsfwCategory, string> = { porn: 'Porn', hentai: 'Hentai' };
const STREAK_TO_DETECT = 3;
const INTERVAL_MS = 1000;

let modelPromise: Promise<NSFWJS> | null = null;

/** Carga (una sola vez) TensorFlow.js y el modelo. Se puede llamar antes para precargar. */
export function loadNsfwModel(): Promise<NSFWJS> {
  modelPromise ??= (async () => {
    const tf = await import('@tensorflow/tfjs');
    if (!(await tf.setBackend('webgl').catch(() => false))) await tf.setBackend('cpu');
    await tf.ready();
    const [{ load }, { MobileNetV2Model }] = await Promise.all([import('nsfwjs/core'), import('nsfwjs/models/mobilenet_v2')]);
    return load('MobileNetV2', { modelDefinitions: [MobileNetV2Model] });
  })();
  modelPromise.catch(() => (modelPromise = null)); // permitir reintentar si falla la carga
  return modelPromise;
}

/**
 * Vigila un stream. Llama a onDetect una sola vez (con la categoría y la confianza) cuando detecta
 * contenido sexual sostenido. Devuelve la función para dejar de vigilar.
 */
export function watchStream(stream: MediaStream, onDetect: (category: NsfwCategory, score: number) => void): () => void {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  void video.play().catch(() => {});

  // Solo en desarrollo: ?nsfwtest simula una detección para probar el flujo completo sin contenido real
  const simulate = import.meta.env.DEV && new URLSearchParams(location.search).has('nsfwtest');

  let stopped = false;
  let streak = 0;
  let timer: ReturnType<typeof setTimeout>;

  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const model = await loadNsfwModel();
        const predictions = await model.classify(video);
        const prob = (c: NsfwCategory) => (simulate && c === 'porn' ? 0.99 : predictions.find((p) => p.className === CLASS[c])?.probability ?? 0);
        const hit = (['porn', 'hentai'] as const).find((c) => prob(c) >= THRESHOLDS[c]);
        streak = hit ? streak + 1 : 0;
        if (hit && streak >= STREAK_TO_DETECT && !stopped) {
          stopped = true;
          onDetect(hit, Math.round(prob(hit) * 1000) / 1000);
          return;
        }
      }
    } catch (err) {
      console.warn('[moderación] análisis no disponible:', (err as Error).message);
    }
    timer = setTimeout(tick, INTERVAL_MS);
  };
  timer = setTimeout(tick, INTERVAL_MS);

  return () => {
    stopped = true;
    clearTimeout(timer);
    video.srcObject = null;
  };
}
