import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWebRTC } from '../hooks/useWebRTC';
import VideoWindow from '../components/VideoWindow';
import ChatControls from '../components/ChatControls';
import ChatPanel from '../components/ChatPanel';
import { Logo } from '../components/Header';
import ThemeToggle from '../components/ThemeToggle';
import { REPORT_REASONS } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from '../components/AvatarPicker';
import { anonymousAvatar, randomSeed } from '../avatar';
import { useSocket, useSocketEvent } from '../hooks/useSocket';
import { loadNsfwModel, watchStream } from '../moderation/nsfw';
import { parseDbDate } from '../services/api';
import { usePresence } from '../hooks/usePresence';
import FriendegleHour from '../components/FriendegleHour';
import { track } from '../services/analytics';

type Sanction = { action: 'warning' | 'ban_24h' | 'ban_permanent'; until: string | null };

function Spinner({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="size-12 animate-spin rounded-full border-4 border-white/20 border-t-white/90" />
      <p className="text-lg">{text}</p>
    </div>
  );
}

function Banner({ tone, children }: { tone: 'info' | 'warn' | 'friend' | 'ok'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-surface text-ink',
    warn: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200',
    friend: 'bg-brand-600 text-white',
    ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200',
  };
  return <p className={`rounded-lg px-3 py-2 text-sm font-medium ${styles[tone]}`}>{children}</p>;
}

export default function VideoChatPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const demo = params.has('demo');
  const { user } = useAuth();
  // Mi avatar: el de mi cuenta o, en modo anónimo, uno aleatorio para esta visita
  const [myAvatar] = useState(() => user?.avatarUrl || anonymousAvatar(randomSeed()));
  const chat = useWebRTC({ demo, avatarUrl: myAvatar });
  const [reportOpen, setReportOpen] = useState(false);
  const socket = useSocket();
  const online = usePresence();
  useEffect(() => {
    if (chat.match && !demo) track('Chat emparejado');
  }, [chat.match, demo]);
  useEffect(() => {
    if (chat.friendState === 'accepted') track('Amistad en videochat');
  }, [chat.friendState]);

  // ---- Moderación automática: se analiza en este navegador el vídeo que RECIBO (nunca se guarda ni se envía) ----
  const [hiddenByModeration, setHiddenByModeration] = useState(false);
  const [sanction, setSanction] = useState<Sanction | null>(null);
  useEffect(() => {
    if (!demo) loadNsfwModel().catch(() => {}); // precarga mientras se busca pareja
  }, [demo]);
  useEffect(() => {
    setHiddenByModeration(false);
    if (demo || !chat.remoteStream) return;
    return watchStream(chat.remoteStream, (category, score) => {
      setHiddenByModeration(true); // ocultar al instante a quien lo está viendo
      socket.emit('moderation:auto-detect', { category, score });
    });
  }, [chat.remoteStream, demo, socket]);
  // Si el infractor soy yo: el servidor me avisa de la sanción
  useSocketEvent<Sanction>(
    'moderation:sanction',
    useCallback((s) => {
      setSanction(s);
      if (s.action === 'warning') chat.skip();
    }, [chat.skip]),
  );

  const connected = chat.status === 'connected' || chat.status === 'connecting';

  const placeholder =
    chat.status === 'suspended' ? (
      <div className="max-w-sm p-6 text-center">
        <p className="text-4xl">⛔</p>
        <p className="mt-3 text-lg font-semibold text-white">Tu acceso al chat está suspendido</p>
        <p className="mt-2 text-sm">Por reportes de otros usuarios o por contenido inapropiado detectado. Vuelve a intentarlo más tarde.</p>
      </div>
    ) : chat.status === 'starting' ? (
      <Spinner text="Encendiendo cámara…" />
    ) : chat.status === 'connecting' && chat.match ? (
      <div className="flex flex-col items-center gap-3">
        <Avatar avatarUrl={chat.match.partnerAvatar} size="lg" />
        <p className="text-lg">Conectando vídeo…</p>
      </div>
    ) : chat.status === 'connecting' ? (
      <Spinner text="Conectando vídeo…" />
    ) : (
      <Spinner text="Buscando a alguien…" />
    );

  const banners = [
    !demo && !chat.match && online === null && chat.status === 'searching' && <FriendegleHour key="hour" compact />,
    chat.notice && <Banner key="notice" tone="info">{chat.notice}</Banner>,
    chat.usingFakeCamera && (
      <Banner key="cam" tone="warn">
        No se pudo acceder a tu cámara; el otro usuario ve tu avatar.
      </Banner>
    ),
    chat.partnerWantsFriend && chat.friendState === 'none' && (
      <Banner key="friend" tone="friend">
        {chat.match?.partnerLabel} quiere ser tu amigo 🤝 Pulsa “Aceptar amistad”.
      </Banner>
    ),
    chat.friendState === 'accepted' && (
      <Banner key="ok" tone="ok">
        ¡Ahora son amigos! Ya pueden ver sus perfiles.
      </Banner>
    ),
  ].filter(Boolean);

  return (
    <div className="flex h-dvh flex-col bg-celeste-100 md:flex-row">
      {/* IZQUIERDA (50%): dos cámaras del mismo tamaño. Móvil: lado a lado; escritorio: arriba/abajo */}
      <section className="grid h-[40dvh] shrink-0 grid-cols-2 gap-2 p-2 md:h-auto md:w-1/2 md:grid-cols-1 md:grid-rows-2 md:p-3">
        <div className="relative min-h-0">
          <VideoWindow
            stream={chat.remoteStream}
            label={chat.match ? `${chat.match.partnerLabel}${demo ? ' · demo' : ''}` : undefined}
            avatarUrl={chat.match?.partnerAvatar}
            className={`h-full rounded-2xl shadow-md ${hiddenByModeration ? '[&_video]:blur-3xl' : ''}`}
            placeholder={placeholder}
          />
          {hiddenByModeration && (
            <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/60 p-4 text-center text-white">
              <p className="text-sm font-semibold">🛡️ Contenido inapropiado ocultado automáticamente</p>
            </div>
          )}
        </div>
        <VideoWindow
          stream={chat.localStream}
          muted
          mirrored={!chat.usingFakeCamera}
          label={chat.match ? `Tú · ${chat.match.myLabel}` : 'Tú'}
          avatarUrl={myAvatar}
          className="min-h-0 rounded-2xl shadow-md"
        />
      </section>

      {/* DERECHA (50%): chat de la videollamada */}
      <section className="flex min-h-0 flex-1 flex-col border-celeste-200 bg-surface md:w-1/2 md:border-l">
        <div className="flex items-center justify-between px-4 pt-3">
          <Logo />
          <ThemeToggle />
        </div>
        <ChatPanel
          messages={chat.messages}
          ready={chat.chatReady}
          partnerLabel={chat.match?.partnerLabel}
          onSend={chat.sendMessage}
          banners={banners.length ? banners : undefined}
          controls={
            <ChatControls
              connected={connected && !!chat.match}
              canAddFriend={!!chat.match?.canAddFriend}
              friendState={chat.friendState}
              partnerWantsFriend={chat.partnerWantsFriend}
              onSkip={chat.skip}
              onAddFriend={chat.addFriend}
              onReport={() => setReportOpen(true)}
              onEnd={() => navigate('/')}
            />
          }
        />
      </section>

      {sanction && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/70 p-4" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-2xl">
            <p className="text-4xl">{sanction.action === 'warning' ? '⚠️' : '⛔'}</p>
            <h2 className="mt-2 text-lg font-bold">Contenido inapropiado detectado</h2>
            <p className="mt-2 text-sm text-ink-soft">
              {sanction.action === 'warning'
                ? 'Esto es una advertencia. Si vuelve a ocurrir, tu acceso se suspenderá 24 horas.'
                : sanction.action === 'ban_24h'
                  ? `Ban: 24h. Podrás volver el ${parseDbDate(sanction.until)?.toLocaleString() ?? 'mañana'}.`
                  : 'Ban permanente por reincidencia.'}
            </p>
            <p className="mt-2 text-xs text-ink-soft">
              Detección automática. Si crees que es un error, escríbenos: un moderador puede revisarla y anularla.
            </p>
            <button
              onClick={() => (sanction.action === 'warning' ? setSanction(null) : navigate('/'))}
              className="mt-4 w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700"
            >
              {sanction.action === 'warning' ? 'Entendido' : 'Salir'}
            </button>
          </div>
        </div>
      )}

      {reportOpen && (
        <div className="fixed inset-0 z-10 grid place-items-center bg-black/60 p-4" onClick={() => setReportOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Reportar a {chat.match?.partnerLabel}</h2>
            <p className="mb-4 mt-1 text-sm text-ink-soft">El chat terminará y no volverán a coincidir.</p>
            <div className="flex flex-col gap-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => {
                    chat.report(r.value);
                    setReportOpen(false);
                  }}
                  className="rounded-lg border border-celeste-200 px-4 py-2.5 text-left text-sm hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-400/10"
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  chat.block();
                  setReportOpen(false);
                }}
                className="flex-1 rounded-lg bg-celeste-100 py-2 text-sm hover:bg-celeste-200"
              >
                Solo bloquear
              </button>
              <button onClick={() => setReportOpen(false)} className="flex-1 rounded-lg py-2 text-sm text-ink-soft hover:bg-celeste-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
