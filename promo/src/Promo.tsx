import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import timeline from './timeline.json';

/**
 * Video del concurso "Gana $20.000 en Friendegle" (TikTok, 1080×1920, ~30 s).
 * El contenido importante queda en el centro: TikTok tapa arriba, abajo y el lateral derecho con su interfaz.
 */

// Código de EJEMPLO: el real solo se muestra en vivo durante la Hora Friendegle (si saliera aquí, cualquiera lo copiaría)
const EXAMPLE_CODE = 'FRIENDEGLE2026-XYZ123';
const PRIZE = 20000;
const SITE = 'friendegle.vercel.app';

const C = {
  navy: '#0b1b3a',
  brand: '#1976d2',
  brandLight: '#1e88e5',
  celeste: '#bbdefb',
  celesteBg: '#e3f2fd',
  gold: '#ffc83d',
  orange: '#ff7a1a',
  green: '#22c55e',
  white: '#ffffff',
};
const FONT = '"Segoe UI", "Segoe UI Emoji", Arial, sans-serif';
const money = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

const scene = (id: string) => timeline.scenes.find((s) => s.id === id)!;

// Subtítulos de lo que dice la voz (muchos ven TikTok sin sonido)
const CAPTIONS: Record<string, string> = {
  hook: '¿Quieres ganar 20 mil pesos? 🤑',
  clock: 'Entra a Friendegle entre las 22 y 23 hs',
  sign: 'Busca al usuario con el cartel 🪧',
  phone: 'Ingresa el código único…',
  winner: '¡Y gana el premio! 🏆',
};

// ------------------------------------------------------------------ piezas comunes

function Background() {
  const frame = useCurrentFrame();
  const shift = Math.sin(frame / 40) * 8;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% ${35 + shift}%, ${C.brandLight} 0%, ${C.brand} 30%, ${C.navy} 85%)`,
      }}
    >
      {/* burbujas suaves de fondo */}
      {Array.from({ length: 14 }, (_, i) => {
        const size = 80 + random(`b${i}`) * 220;
        const x = random(`x${i}`) * 1080;
        const y = (random(`y${i}`) * 2200 - frame * (0.6 + random(`s${i}`) * 1.4)) % 2200;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - size / 2,
              top: (y < -300 ? y + 2200 : y) - size / 2,
              width: size,
              height: size,
              borderRadius: '50%',
              background: 'rgba(187,222,251,0.08)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

function Logo({ scale = 1, color = C.white }: { scale?: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 * scale, fontFamily: FONT, fontWeight: 900, color, fontSize: 96 * scale }}>
      <div
        style={{
          width: 130 * scale,
          height: 130 * scale,
          borderRadius: 34 * scale,
          background: C.white,
          display: 'grid',
          placeItems: 'center',
          fontSize: 80 * scale,
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        👋
      </div>
      <span style={{ letterSpacing: -2 * scale, textShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>Friendegle</span>
    </div>
  );
}

function Caption({ text }: { text: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 6, fps, config: { damping: 14 } });
  return (
    <div style={{ position: 'absolute', left: 60, right: 170, top: 1330, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 62,
          lineHeight: 1.15,
          color: C.navy,
          background: C.white,
          padding: '22px 36px',
          borderRadius: 28,
          textAlign: 'center',
          transform: `scale(${pop}) rotate(${(1 - pop) * -4}deg)`,
          boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
        }}
      >
        {text}
      </div>
    </div>
  );
}

const Sfx = ({ at, src, volume = 0.8 }: { at: number; src: string; volume?: number }) => (
  <Sequence from={Math.max(0, Math.round(at))} layout="none">
    <Audio src={staticFile(`sfx/${src}.wav`)} volume={volume} />
  </Sequence>
);

const center: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };

// ------------------------------------------------------------------ escena 1: gancho + dinero

function HookScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoIn = spring({ frame, fps, config: { damping: 12 } });
  const counter = interpolate(frame, [30, 85], [0, PRIZE], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (t) => 1 - (1 - t) ** 3 });
  const done = frame >= 85;
  const punch = done ? 1 + 0.12 * Math.exp(-(frame - 85) / 6) * Math.cos((frame - 85) / 2) : 1;
  return (
    <AbsoluteFill>
      {/* lluvia de billetes */}
      {Array.from({ length: 26 }, (_, i) => {
        const start = 25 + random(`d${i}`) * 60;
        const t = frame - start;
        if (t < 0) return null;
        const x = random(`bx${i}`) * 1000;
        const y = -150 + t * (14 + random(`bv${i}`) * 10);
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, fontSize: 90 + random(`bs${i}`) * 50, transform: `rotate(${t * (random(`br${i}`) * 8 - 4)}deg)` }}>
            💵
          </div>
        );
      })}
      <AbsoluteFill style={{ ...center, gap: 60, paddingBottom: 300 }}>
        <div style={{ transform: `scale(${logoIn}) translateY(${(1 - logoIn) * -200}px)` }}>
          <Logo />
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 58, color: C.celeste, opacity: interpolate(frame, [20, 30], [0, 1], { extrapolateRight: 'clamp' }), letterSpacing: 6 }}>
          🏆 CONCURSO 🏆
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 230,
            color: C.gold,
            textShadow: '0 12px 0 #b7791f, 0 30px 60px rgba(0,0,0,0.45)',
            transform: `scale(${punch})`,
            opacity: frame >= 30 ? 1 : 0,
          }}
        >
          {money(counter)}
        </div>
      </AbsoluteFill>
      <Sfx at={2} src="whoosh" />
      <Sfx at={85} src="cash" volume={0.9} />
    </AbsoluteFill>
  );
}

// ------------------------------------------------------------------ escena 2: reloj 22–23 hs

function ClockScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inAnim = spring({ frame, fps, config: { damping: 13 } });
  // las agujas giran rápido de 21:30 a 22:00 y luego avanzan hasta las 23:00
  const minutes = interpolate(frame, [0, 40, 130], [21 * 60 + 30, 22 * 60, 23 * 60], { extrapolateRight: 'clamp', easing: (t) => t * (2 - t) });
  const hourAngle = ((minutes / 60) % 12) * 30;
  const minuteAngle = (minutes % 60) * 6;
  const R = 330;
  // arco resaltado de 22 a 23 (en la esfera: de las 10 a las 11)
  const arc = (a0: number, a1: number, r: number) => {
    const p = (a: number) => [R + r * Math.sin((a * Math.PI) / 180), R - r * Math.cos((a * Math.PI) / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M ${R} ${R} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`;
  };
  const arcEnd = interpolate(frame, [40, 130], [300, 330], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const hh = Math.floor(minutes / 60), mm = Math.floor(minutes % 60);
  return (
    <AbsoluteFill style={{ ...center, gap: 40, paddingBottom: 560 }}>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 80, color: C.white, transform: `scale(${inAnim})` }}>⏰ Hora Friendegle</div>
      <svg width={R * 2} height={R * 2} style={{ transform: `scale(${inAnim}) rotate(${(1 - inAnim) * -30}deg)`, filter: 'drop-shadow(0 30px 50px rgba(0,0,0,0.4))' }}>
        <circle cx={R} cy={R} r={R - 6} fill={C.white} stroke={C.celeste} strokeWidth={12} />
        {frame >= 40 && <path d={arc(300, arcEnd, R - 30)} fill={C.orange} opacity={0.85} />}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          return (
            <text key={i} x={R + (R - 70) * Math.sin(a)} y={R - (R - 70) * Math.cos(a) + 20} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={54} fill={C.navy}>
              {i === 0 ? 12 : i}
            </text>
          );
        })}
        <line x1={R} y1={R} x2={R + 170 * Math.sin((hourAngle * Math.PI) / 180)} y2={R - 170 * Math.cos((hourAngle * Math.PI) / 180)} stroke={C.navy} strokeWidth={22} strokeLinecap="round" />
        <line x1={R} y1={R} x2={R + 250 * Math.sin((minuteAngle * Math.PI) / 180)} y2={R - 250 * Math.cos((minuteAngle * Math.PI) / 180)} stroke={C.brand} strokeWidth={12} strokeLinecap="round" />
        <circle cx={R} cy={R} r={20} fill={C.orange} />
      </svg>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', fontFamily: FONT, fontWeight: 900 }}>
        <div style={{ fontSize: 110, color: C.white, fontVariantNumeric: 'tabular-nums' }}>
          {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}
        </div>
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 70,
          color: C.navy,
          background: C.gold,
          padding: '14px 40px',
          borderRadius: 999,
          opacity: interpolate(frame, [45, 55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}
      >
        🔥 22:00 a 23:00 hs 🔥
      </div>
      {[0, 10, 20, 30, 40].map((f) => (
        <Sfx key={f} at={f} src="tick" volume={0.5} />
      ))}
      <Sfx at={45} src="pop" />
    </AbsoluteFill>
  );
}

// ------------------------------------------------------------------ escena 3: la persona con el cartel

/** Persona ilustrada con la cara pixelada (como en un video anónimo) y un cartel con número borroso + código. */
function PersonWithSign({ frame, showCode = true }: { frame: number; showCode?: boolean }) {
  const sway = Math.sin(frame / 12) * 2.5;
  const skin = ['#e8b894', '#d9a47f', '#c98f6b', '#f0c6a4', '#b97d5b'];
  const px = 11; // bloques de la cara pixelada
  const tick = Math.floor(frame / 5); // el mosaico "vibra" como un filtro en vivo
  return (
    <svg viewBox="0 0 1000 1300" width="100%" height="100%">
      <defs>
        <clipPath id="face">
          <ellipse cx={500} cy={300} rx={150} ry={175} />
        </clipPath>
        <filter id="blur">
          <feGaussianBlur stdDeviation={9} />
        </filter>
        <linearGradient id="room" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#35507a" />
          <stop offset="1" stopColor="#1b2b48" />
        </linearGradient>
      </defs>
      <rect width={1000} height={1300} fill="url(#room)" />
      <rect x={640} y={120} width={260} height={320} rx={16} fill="#2a4166" />
      <circle cx={180} cy={200} r={70} fill="#f6d365" opacity={0.25} />
      {/* cuerpo (buzo) */}
      <path d="M 170 1300 Q 190 640 500 610 Q 810 640 830 1300 Z" fill="#ff5a5f" />
      <rect x={455} y={440} width={90} height={120} fill={skin[1]} />
      {/* pelo + cabeza */}
      <ellipse cx={500} cy={255} rx={170} ry={165} fill="#2d1b12" />
      <g clipPath="url(#face)">
        {Array.from({ length: px * px }, (_, i) => {
          const col = i % px, row = Math.floor(i / px);
          const size = 350 / px;
          return (
            <rect
              key={i}
              x={350 + col * size}
              y={125 + row * size}
              width={size + 1}
              height={size + 1}
              fill={skin[Math.floor(random(`p${i}-${tick}`) * skin.length)]}
            />
          );
        })}
      </g>
      {/* cartel sostenido con las dos manos */}
      <g transform={`rotate(${sway} 500 900)`}>
        <rect x={150} y={640} width={700} height={560} rx={28} fill="#fffdf5" stroke="#d6c7a1" strokeWidth={8} />
        <text x={500} y={720} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={44} fill="#8a7a55">
          CONCURSO FRIENDEGLE
        </text>
        {/* número: borroso pero reconocible como número */}
        <text x={500} y={930} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={240} fill={C.brand} filter="url(#blur)">
          N°07
        </text>
        {showCode && (
          <>
            <rect x={185} y={1010} width={630} height={150} rx={20} fill={C.navy} />
            <text x={500} y={1058} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={30} fill={C.celeste}>
              CÓDIGO (ejemplo)
            </text>
            <text x={500} y={1125} textAnchor="middle" fontFamily="Consolas, monospace" fontWeight={700} fontSize={50} fill={C.gold}>
              {EXAMPLE_CODE}
            </text>
          </>
        )}
        {/* manos */}
        <circle cx={160} cy={930} r={55} fill={skin[1]} />
        <circle cx={840} cy={930} r={55} fill={skin[1]} />
      </g>
    </svg>
  );
}

function SignScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inAnim = spring({ frame, fps, config: { damping: 15 } });
  // acercamiento de cámara al código
  const zoom = interpolate(frame, [80, 130], [1, 1.25], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (t) => t * t * (3 - 2 * t) });
  const highlight = interpolate(frame, [130, 140], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ ...center, paddingBottom: 330 }}>
      {/* marco de videollamada de Friendegle */}
      <div
        style={{
          width: 860,
          height: 1118,
          borderRadius: 48,
          overflow: 'hidden',
          position: 'relative',
          border: `10px solid ${C.white}`,
          boxShadow: '0 40px 80px rgba(0,0,0,0.45)',
          transform: `scale(${0.6 + 0.4 * inAnim}) rotate(${(1 - inAnim) * 8}deg)`,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: '50% 86%' }}>
          <PersonWithSign frame={frame} />
        </div>
        <div style={{ position: 'absolute', left: 28, top: 28, display: 'flex', gap: 14, fontFamily: FONT, fontWeight: 800, fontSize: 34 }}>
          <span style={{ background: 'rgba(0,0,0,0.55)', color: C.white, padding: '8px 20px', borderRadius: 999 }}>User_4821</span>
          <span style={{ background: C.orange, color: C.white, padding: '8px 20px', borderRadius: 999 }}>🪧 ¡Tiene cartel!</span>
        </div>
        <div style={{ position: 'absolute', right: 24, bottom: 24, opacity: 0.9 }}>
          <Logo scale={0.35} />
        </div>
        {highlight > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 60,
              right: 60,
              top: 800,
              height: 195,
              borderRadius: 30,
              border: `10px solid ${C.gold}`,
              opacity: highlight,
              boxShadow: `0 0 ${40 + Math.sin(frame / 3) * 20}px ${C.gold}`,
            }}
          />
        )}
      </div>
      {highlight > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 150,
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 64,
            color: C.gold,
            opacity: highlight,
            transform: `translateY(${Math.sin(frame / 5) * 8}px)`,
            textShadow: '0 6px 20px rgba(0,0,0,0.5)',
          }}
        >
          👇 ¡Anota el código! 👇
        </div>
      )}
      <Sfx at={0} src="whoosh" />
      <Sfx at={80} src="riser" volume={0.35} />
      <Sfx at={130} src="pop" />
    </AbsoluteFill>
  );
}

// ------------------------------------------------------------------ escena 4: teléfono con el chat

function Bubble({ mine, children, appear }: { mine?: boolean; children: ReactNode; appear: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - appear, fps, config: { damping: 14 } });
  if (frame < appear) return null;
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', transform: `scale(${s})`, transformOrigin: mine ? '100% 100%' : '0 100%' }}>
      <div
        style={{
          maxWidth: '82%',
          background: mine ? C.brand : '#eef4fb',
          color: mine ? C.white : C.navy,
          padding: '20px 28px',
          borderRadius: 30,
          fontSize: 38,
          fontWeight: 600,
          lineHeight: 1.25,
          overflowWrap: 'anywhere',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function PhoneScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inAnim = spring({ frame, fps, config: { damping: 14 } });
  const typeStart = 30, perChar = 2;
  const typed = Math.max(0, Math.min(EXAMPLE_CODE.length, Math.floor((frame - typeStart) / perChar)));
  const sendAt = typeStart + EXAMPLE_CODE.length * perChar + 10;
  const sent = frame >= sendAt;
  const okAt = sendAt + 30;
  return (
    <AbsoluteFill style={{ ...center, paddingBottom: 330 }}>
      <div
        style={{
          width: 700,
          height: 1180,
          background: '#0a0a0a',
          borderRadius: 90,
          padding: 22,
          boxShadow: '0 50px 100px rgba(0,0,0,0.5)',
          transform: `translateY(${(1 - inAnim) * 900}px) rotate(${(1 - inAnim) * -10}deg)`,
        }}
      >
        <div style={{ width: '100%', height: '100%', borderRadius: 70, overflow: 'hidden', background: C.celesteBg, display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
          {/* video del otro usuario (miniatura) */}
          <div style={{ height: 430, position: 'relative', background: C.navy }}>
            <PersonWithSign frame={frame} showCode={false} />
            <span style={{ position: 'absolute', left: 24, top: 60, background: 'rgba(0,0,0,0.55)', color: C.white, padding: '6px 18px', borderRadius: 999, fontWeight: 800, fontSize: 28 }}>
              User_4821
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 28px', background: C.white }}>
            <Logo scale={0.32} color={C.brand} />
          </div>
          {/* mensajes */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 18, padding: 26 }}>
            <Bubble appear={8}>¡Hola! 👋 Escribe el código de mi cartel</Bubble>
            {sent && (
              <Bubble mine appear={sendAt}>
                <span style={{ fontFamily: 'Consolas, monospace', fontSize: 34, whiteSpace: 'nowrap' }}>{EXAMPLE_CODE}</span>
              </Bubble>
            )}
            <Bubble appear={okAt}>✅ ¡Código correcto! 🎉</Bubble>
          </div>
          {/* barra de escritura */}
          <div style={{ display: 'flex', gap: 14, padding: '18px 22px 34px', background: C.white }}>
            <div
              style={{
                flex: 1,
                border: `4px solid ${sent ? C.celeste : C.brand}`,
                borderRadius: 24,
                padding: '16px 20px',
                fontSize: 32,
                fontFamily: 'Consolas, monospace',
                fontWeight: 700,
                color: C.navy,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {sent ? <span style={{ color: '#94a3b8', fontFamily: FONT }}>Escribe un mensaje…</span> : EXAMPLE_CODE.slice(0, typed)}
              {!sent && frame % 16 < 8 && <span style={{ color: C.brand }}>|</span>}
            </div>
            <div style={{ background: C.brand, color: C.white, borderRadius: 24, padding: '16px 26px', fontSize: 32, fontWeight: 800, transform: `scale(${frame >= sendAt - 4 && frame < sendAt + 2 ? 0.9 : 1})` }}>
              Enviar
            </div>
          </div>
        </div>
      </div>
      {Array.from({ length: EXAMPLE_CODE.length }, (_, i) => (
        <Sfx key={i} at={typeStart + i * perChar} src="key" volume={0.45} />
      ))}
      <Sfx at={sendAt} src="ding" volume={0.6} />
      <Sfx at={okAt} src="pop" />
      <Sfx at={okAt + 25} src="riser" volume={0.5} />
    </AbsoluteFill>
  );
}

// ------------------------------------------------------------------ escena 5: ¡ganador! con confeti

function Confetti() {
  const frame = useCurrentFrame();
  const colors = [C.gold, C.orange, '#ff4d8d', C.green, C.celeste, C.white, '#a855f7'];
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: 160 }, (_, i) => {
        const angle = -Math.PI / 2 + (random(`ca${i}`) - 0.5) * 2.2;
        const speed = 28 + random(`cs${i}`) * 34;
        const t = frame - 4;
        if (t < 0) return null;
        // explota desde el centro y cae con gravedad y rozamiento
        const drag = (1 - Math.exp(-t / 18)) * 18;
        const x = 540 + Math.cos(angle) * speed * drag + Math.sin(t / 6 + i) * 20;
        const y = 850 + Math.sin(angle) * speed * drag + 0.9 * t * t * 0.25;
        const w = 18 + random(`cw${i}`) * 16;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: w,
              height: w * 0.55,
              background: colors[i % colors.length],
              borderRadius: 4,
              transform: `rotate(${t * (random(`cr${i}`) * 30 - 15)}deg) scaleY(${Math.cos(t / 4 + i)})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

function WinnerScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const big = spring({ frame, fps, config: { damping: 8, stiffness: 120 } });
  const prize = spring({ frame: frame - 18, fps, config: { damping: 12 } });
  const cta = spring({ frame: frame - 60, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, rgba(255,200,61,${0.35 * big}) 0%, transparent 60%)` }} />
      {/* rayos giratorios */}
      <AbsoluteFill style={{ opacity: 0.18 * big, transform: `rotate(${frame * 0.6}deg) scale(2)` }}>
        <div style={{ position: 'absolute', inset: 0, background: `repeating-conic-gradient(from 0deg at 50% 44%, ${C.gold} 0deg 10deg, transparent 10deg 30deg)` }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ ...center, gap: 40, paddingBottom: 380 }}>
        <div style={{ fontSize: 170, transform: `scale(${big})` }}>🏆</div>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 170,
            color: C.gold,
            letterSpacing: -4,
            textShadow: '0 12px 0 #b7791f, 0 30px 70px rgba(0,0,0,0.5)',
            transform: `scale(${big}) rotate(${Math.sin(frame / 8) * 2}deg)`,
          }}
        >
          ¡GANADOR!
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 130, color: C.white, transform: `scale(${prize})`, textShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
          {money(PRIZE)}
        </div>
        <div style={{ transform: `scale(${cta})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
          <Logo scale={0.8} />
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 50, color: C.navy, background: C.white, padding: '14px 36px', borderRadius: 999 }}>{SITE}</div>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, color: C.celeste }}>Solo +18 · Bases y condiciones en la bio</div>
        </div>
      </AbsoluteFill>
      <Confetti />
      <Sfx at={0} src="win" volume={0.9} />
      <Sfx at={18} src="cash" volume={0.7} />
    </AbsoluteFill>
  );
}

// ------------------------------------------------------------------ montaje

const SCENES: Record<string, () => ReactNode> = {
  hook: HookScene,
  clock: ClockScene,
  sign: SignScene,
  phone: PhoneScene,
  winner: WinnerScene,
};

export function Promo() {
  const { durationInFrames } = useVideoConfig();
  // Momentos con voz: la música baja para que se entienda
  const talking = (f: number) => timeline.scenes.some((s) => f >= s.from + s.voiceAt && f < s.from + s.voiceAt + s.voiceFrames);
  return (
    <AbsoluteFill style={{ backgroundColor: C.navy, fontFamily: FONT }}>
      <Background />
      {timeline.scenes.map((s) => {
        const Scene = SCENES[s.id];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.duration} name={s.id}>
            <SceneTransition duration={s.duration}>
              <Scene />
            </SceneTransition>
            <Caption text={CAPTIONS[s.id]} />
            <Sequence from={s.voiceAt} layout="none">
              <Audio src={staticFile(s.voice)} volume={1} />
            </Sequence>
          </Sequence>
        );
      })}
      <Audio
        src={staticFile('music.wav')}
        volume={(f) =>
          (talking(f) ? 0.22 : 0.4) *
          interpolate(f, [0, 10, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        }
      />
    </AbsoluteFill>
  );
}

/** Entrada/salida rápida de cada escena (zoom + fundido) para un ritmo de TikTok. */
function SceneTransition({ children, duration }: { children: ReactNode; duration: number }) {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [duration - 8, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const inn = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity: Math.min(inn, out), transform: `scale(${1 + (1 - out) * 0.15})` }}>{children}</AbsoluteFill>;
}
