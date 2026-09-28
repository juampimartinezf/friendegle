import { useCallback, useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer/simplepeer.min.js';
import type { Instance as PeerInstance, SignalData } from 'simple-peer';
import { useSocket } from './useSocket';

export type ChatStatus = 'starting' | 'searching' | 'connecting' | 'connected' | 'suspended';
export type FriendState = 'none' | 'sent' | 'accepted' | 'already' | 'unavailable';

/** Mensaje del chat de texto. Solo vive en memoria durante el chat actual. */
export interface ChatMessage {
  id: number;
  from: 'me' | 'them' | 'system';
  text: string;
}

export const MAX_MESSAGE_LENGTH = 500;
const MAX_MESSAGES = 200;
const BOT_REPLIES = ['¡Hola! 👋', 'Soy un bot de prueba, pero te leo perfectamente.', '¿De dónde eres?', 'Jaja, qué bueno 😄', 'Prueba a pulsar SKIP para "conocer" a otro bot.'];

export interface MatchInfo {
  myLabel: string;
  partnerLabel: string;
  canAddFriend: boolean;
}

/**
 * PRIVACIDAD DE IP: 'relay' obliga a que TODO el tráfico pase por nuestro servidor TURN.
 * El navegador ni siquiera recoge candidatos host/srflx, así que el desconocido solo
 * ve la IP del TURN. (El STUN que llega en iceServers queda sin uso bajo esta política.)
 * Está fijado aquí a propósito: no depende de lo que diga el servidor.
 */
const ICE_TRANSPORT_POLICY: RTCIceTransportPolicy = 'relay';

/**
 * Fallback si el servidor no envía servidores ICE. Solo existe en desarrollo:
 * `import.meta.env.DEV` es false en el build y estas credenciales no llegan al bundle de producción.
 */
const DEFAULT_ICE_SERVERS: RTCIceServer[] = import.meta.env.DEV
  ? [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: ['turn:localhost:3478?transport=udp', 'turn:localhost:3478?transport=tcp'],
        username: 'friendegle',
        credential: 'friendegle123',
      },
    ]
  : [];

/** Segunda barrera: nunca enviar un candidato que no sea del TURN. */
function isSafeSignal(data: SignalData): boolean {
  const c = (data as { candidate?: RTCIceCandidateInit }).candidate?.candidate;
  return typeof c !== 'string' || c === '' || /\btyp relay\b/.test(c);
}

/**
 * Stream de vídeo sintético (canvas). Se usa si no hay cámara disponible
 * y como "desconocido" en el modo demo, para poder probar sin otra persona.
 */
function createFakeStream(text: string, hue: number): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d')!;
  const stream = canvas.captureStream(24);
  let t = 0;
  const timer = setInterval(() => {
    if (stream.getVideoTracks()[0]?.readyState === 'ended') return clearInterval(timer);
    t += 1;
    const g = ctx.createLinearGradient(0, 0, 640, 480);
    g.addColorStop(0, `hsl(${(hue + t) % 360} 70% 35%)`);
    g.addColorStop(1, `hsl(${(hue + t + 80) % 360} 70% 20%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath();
    ctx.arc(320 + Math.sin(t / 20) * 120, 220, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 32px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(text, 320, 400);
  }, 1000 / 24);
  return stream;
}

async function getLocalMedia(): Promise<{ stream: MediaStream; fake: boolean }> {
  for (const constraints of [{ video: true, audio: true }, { video: true, audio: false }]) {
    try {
      return { stream: await navigator.mediaDevices.getUserMedia(constraints), fake: false };
    } catch {
      /* probar la siguiente opción */
    }
  }
  return { stream: createFakeStream('Sin cámara', 200), fake: true };
}

const randomLabel = () => `User_${Math.floor(1000 + Math.random() * 9000)}`;

export function useWebRTC({ demo = false }: { demo?: boolean } = {}) {
  const socket = useSocket();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [usingFakeCamera, setUsingFakeCamera] = useState(false);
  const [status, setStatus] = useState<ChatStatus>('starting');
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [friendState, setFriendState] = useState<FriendState>('none');
  const [partnerWantsFriend, setPartnerWantsFriend] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatReady, setChatReady] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<PeerInstance | null>(null);
  const demoStreamRef = useRef<MediaStream | null>(null);
  const demoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const messageId = useRef(0);

  const pushMessage = useCallback((from: ChatMessage['from'], text: string) => {
    setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), { id: ++messageId.current, from, text }]);
  }, []);

  const destroyPeer = useCallback(() => {
    peerRef.current?.destroy();
    peerRef.current = null;
    demoStreamRef.current?.getTracks().forEach((t) => t.stop());
    demoStreamRef.current = null;
    clearTimeout(demoTimer.current);
    setRemoteStream(null);
    setMatch(null);
    setFriendState('none');
    setPartnerWantsFriend(false);
    setMessages([]);
    setChatReady(false);
  }, []);

  const search = useCallback(() => {
    destroyPeer();
    setStatus('searching');
    if (demo) {
      // Modo demo: un "desconocido" sintético aparece tras un momento
      demoTimer.current = setTimeout(() => {
        const s = createFakeStream('Bot de prueba 🤖', Math.random() * 360);
        demoStreamRef.current = s;
        const partnerLabel = randomLabel();
        setMatch({ myLabel: randomLabel(), partnerLabel, canAddFriend: false });
        setRemoteStream(s);
        setStatus('connected');
        setMessages([{ id: ++messageId.current, from: 'system', text: `Conectado con ${partnerLabel} (bot de prueba).` }]);
        setChatReady(true);
      }, 1200);
      return;
    }
    socket.emit('queue:join');
  }, [demo, destroyPeer, socket]);

  // Cámara al montar; todo se libera al desmontar
  useEffect(() => {
    let cancelled = false;
    getLocalMedia().then(({ stream, fake }) => {
      if (cancelled) return stream.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      setLocalStream(stream);
      setUsingFakeCamera(fake);
      search();
    });
    return () => {
      cancelled = true;
      if (!demo) {
        socket.emit('queue:leave');
        socket.emit('chat:leave');
      }
      destroyPeer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Eventos de señalización
  useEffect(() => {
    if (demo) return;
    let wasDisconnected = false;

    const onMatched = (m: MatchInfo & { initiator: boolean; iceServers?: RTCIceServer[] }) => {
      destroyPeer();
      setNotice(null);
      setMatch({ myLabel: m.myLabel, partnerLabel: m.partnerLabel, canAddFriend: m.canAddFriend });
      setStatus('connecting');
      pushMessage('system', `Conectando con ${m.partnerLabel}…`);
      const peer = new Peer({
        initiator: m.initiator,
        stream: streamRef.current ?? undefined,
        trickle: true,
        config: { iceServers: m.iceServers ?? DEFAULT_ICE_SERVERS, iceTransportPolicy: ICE_TRANSPORT_POLICY },
      });
      peer.on('signal', (data: SignalData) => {
        if (isSafeSignal(data)) socket.emit('signal', data);
      });
      peer.on('stream', (s: MediaStream) => {
        if (peerRef.current !== peer) return;
        setRemoteStream(s);
        setStatus('connected');
      });
      // Chat de texto por el canal de datos WebRTC: va cifrado (DTLS) por el mismo TURN
      // que el vídeo; el servidor de Friendegle nunca ve ni guarda los mensajes.
      peer.on('connect', () => {
        if (peerRef.current !== peer) return;
        setChatReady(true);
        pushMessage('system', `Conectado con ${m.partnerLabel}. ¡Di hola! 👋`);
      });
      peer.on('data', (raw: Uint8Array | string) => {
        if (peerRef.current !== peer) return;
        try {
          const msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
          if (msg?.type === 'msg' && typeof msg.text === 'string' && msg.text.trim()) {
            pushMessage('them', msg.text.trim().slice(0, MAX_MESSAGE_LENGTH));
          }
        } catch {
          /* mensaje malformado: se ignora */
        }
      });
      peer.on('error', (err: Error & { code?: string }) => {
        console.warn('[webrtc]', err.code, err.message);
        if (peerRef.current !== peer) return;
        if (err.code === 'ERR_ICE_CONNECTION_FAILURE' || err.code === 'ERR_CONNECTION_FAILURE') {
          setNotice('No se pudo conectar el vídeo a través del servidor TURN. Buscando a otra persona…');
          search();
        }
      });
      peerRef.current = peer;
    };

    const onSignal = (data: SignalData) => peerRef.current?.signal(data);

    const onEnded = ({ reason }: { reason: string }) => {
      setNotice(
        reason === 'reported' ? 'El chat terminó.' : reason === 'partner_disconnected' ? 'El usuario se desconectó.' : 'El usuario pasó al siguiente.',
      );
      search();
    };

    const onFriendStatus = ({ state }: { state: FriendState }) => setFriendState(state);
    const onFriendIncoming = () => setPartnerWantsFriend(true);
    const onReportOk = () => {
      setNotice('Reporte enviado. Gracias por mantener Friendegle seguro.');
      search();
    };
    const onBlockOk = () => {
      setNotice('Usuario bloqueado. No volverán a coincidir.');
      search();
    };
    const onWaiting = () => setStatus('searching');
    const onSuspended = () => {
      destroyPeer();
      setStatus('suspended');
    };
    const onDisconnect = () => {
      wasDisconnected = true;
      destroyPeer();
      setStatus('searching');
      setNotice('Conexión perdida, reconectando…');
    };
    const onConnect = () => {
      if (wasDisconnected && streamRef.current) search();
      wasDisconnected = false;
    };

    const handlers: Record<string, (...args: any[]) => void> = {
      'chat:matched': onMatched,
      signal: onSignal,
      'chat:ended': onEnded,
      'friend:status': onFriendStatus,
      'friend:incoming': onFriendIncoming,
      'report:ok': onReportOk,
      'block:ok': onBlockOk,
      'queue:waiting': onWaiting,
      'queue:suspended': onSuspended,
      disconnect: onDisconnect,
      connect: onConnect,
    };
    for (const [e, h] of Object.entries(handlers)) socket.on(e, h);
    return () => {
      for (const [e, h] of Object.entries(handlers)) socket.off(e, h);
    };
  }, [demo, socket, search, destroyPeer, pushMessage]);

  const skip = useCallback(() => {
    setNotice(null);
    search(); // el servidor termina el chat actual al recibir queue:join
  }, [search]);

  const addFriend = useCallback(() => {
    if (demo) return setFriendState('unavailable');
    socket.emit('chat:add-friend');
  }, [demo, socket]);

  const report = useCallback(
    (reason: string) => {
      if (demo) {
        setNotice('Modo demo: el reporte no se envía.');
        return search();
      }
      socket.emit('chat:report', { reason });
    },
    [demo, search, socket],
  );

  const sendMessage = useCallback(
    (input: string) => {
      const text = input.trim().slice(0, MAX_MESSAGE_LENGTH);
      if (!text || !chatReady) return false;
      if (demo) {
        pushMessage('me', text);
        const reply = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
        setTimeout(() => demoStreamRef.current && pushMessage('them', reply), 700);
        return true;
      }
      const peer = peerRef.current;
      if (!peer?.connected) return false;
      peer.send(JSON.stringify({ type: 'msg', text }));
      pushMessage('me', text);
      return true;
    },
    [chatReady, demo, pushMessage],
  );

  const block = useCallback(() => {
    if (demo) return search();
    socket.emit('chat:block');
  }, [demo, search, socket]);

  return {
    localStream,
    remoteStream,
    usingFakeCamera,
    status,
    match,
    friendState,
    partnerWantsFriend,
    notice,
    messages,
    chatReady,
    sendMessage,
    skip,
    addFriend,
    report,
    block,
    retry: search,
  };
}
