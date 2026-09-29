# Video promocional: concurso "Gana $20.000 en Friendegle"

Video vertical de TikTok/Reels/Shorts (1080×1920, 30 fps, ~33 s) hecho con [Remotion](https://www.remotion.dev).

```bash
cd promo
npm install
npm run audio    # música + efectos (sintetizados) y narración (voz local de Windows) → public/, src/timeline.json
npm run studio   # editor en el navegador para previsualizar
npm run render   # → out/friendegle-concurso.mp4
```

| Escena | Qué se ve | Voz |
|---|---|---|
| hook | Logo, "CONCURSO", $20.000 contando con lluvia de billetes | ¿Quieres ganar veinte mil pesos? |
| clock | Reloj que avanza de 22:00 a 23:00 + "🎁 ¡Nuevo concurso TODOS LOS DÍAS!" con calendario | Entra a Friendegle entre las 22 y las 23 horas. ¡Todos los días a esa hora hay un concurso nuevo! |
| sign | Videollamada: persona con la cara pixelada y cartel con número borroso y código legible | Busca al usuario con el cartel |
| phone | Teléfono con el chat de Friendegle: se escribe el código, "✅ ¡Código correcto!" | Ingresa el código único… |
| winner | "¡GANADOR!", $20.000, confeti | ¡Y gana el premio! |
| cta | Logo, "🔗 Link en la bio o en los comentarios", web, +18 y bases | Entra a Friendegle con el link en la bio o en los comentarios |

- **Audio sin derechos de terceros:** la música (128 BPM) y los efectos los genera `scripts/music.mjs` por código. La voz es la de Windows (`scripts/tts.ps1`, Sabina es-MX). Para usar otra voz o una grabación propia, reemplaza `public/voice/v1..v6.wav` y ejecuta `node scripts/timeline.mjs`: las escenas se ajustan solas a la duración de cada frase.
- **Textos, premio y código:** constantes al principio de `src/Promo.tsx` (`EXAMPLE_CODE`, `PRIZE`, `SITE`, `CAPTIONS`, `DAILY_AT`). Las frases narradas están en `scripts/tts.ps1`.
- **El código del video es de ejemplo** a propósito: si saliera el real, cualquiera lo copiaría sin entrar a Friendegle.
- Subtítulos siempre visibles (mucha gente ve TikTok sin sonido). El contenido importante queda en el centro, fuera de las zonas que tapa la interfaz de TikTok.
- Licencia de Remotion: gratis para personas y empresas de hasta 3 empleados; por encima requiere licencia de empresa.
