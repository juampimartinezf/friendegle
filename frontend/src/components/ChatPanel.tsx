import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { MAX_MESSAGE_LENGTH, type ChatMessage } from '../hooks/useWebRTC';

interface Props {
  messages: ChatMessage[];
  ready: boolean;
  partnerLabel?: string;
  onSend: (text: string) => boolean;
  banners?: ReactNode;
  controls: ReactNode;
}

/** Chat de texto de la videollamada. Los mensajes solo existen mientras dura el chat actual. */
export default function ChatPanel({ messages, ready, partnerLabel, onSend, banners, controls }: Props) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (onSend(text)) setText('');
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-celeste-200 px-4 py-3">
        <span className={`size-2.5 rounded-full ${ready ? 'bg-emerald-500' : 'bg-celeste-300'}`} />
        <p className="font-semibold">
          {partnerLabel ? <span className="font-mono">{partnerLabel}</span> : 'Buscando a alguien…'}
        </p>
        <span className="ml-auto text-xs text-ink-soft">🔒 Los mensajes no se guardan</span>
      </header>

      {banners && <div className="flex flex-col gap-2 border-b border-celeste-200 bg-celeste-50 px-4 py-2">{banners}</div>}

      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3" aria-live="polite">
        {messages.length === 0 && (
          <p className="m-auto max-w-xs text-center text-sm text-ink-soft">
            Cuando conectes con alguien podréis escribiros aquí. En el chat solo sois User_XXXX.
          </p>
        )}
        {messages.map((m) =>
          m.from === 'system' ? (
            <p key={m.id} className="self-center rounded-full bg-celeste-100 px-3 py-1 text-xs text-ink-soft">
              {m.text}
            </p>
          ) : (
            <p
              key={m.id}
              className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                m.from === 'me' ? 'self-end rounded-br-md bg-brand-600 text-white' : 'self-start rounded-bl-md bg-celeste-100 text-ink'
              }`}
            >
              {m.text}
            </p>
          ),
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-celeste-200 p-3">
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={!ready}
            placeholder={ready ? 'Escribe un mensaje…' : 'Esperando conexión…'}
            aria-label="Mensaje"
            className="min-w-0 flex-1 rounded-xl border border-celeste-300 bg-celeste-50 px-3 py-2.5 text-sm outline-none transition placeholder:text-ink-soft/60 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/25 disabled:opacity-60"
          />
          <button
            disabled={!ready || !text.trim()}
            className="rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            Enviar
          </button>
        </form>
        {controls}
      </div>
    </div>
  );
}
