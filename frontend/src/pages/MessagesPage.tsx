import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocketEvent } from '../hooks/useSocket';
import { Avatar } from '../components/AvatarPicker';
import { api, MAX_DM_LENGTH, parseDbDate, type Conversation, type DirectMessage } from '../services/api';

const time = (s: string | null) =>
  parseDbDate(s)?.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) ?? '';

/** /messages: lista de conversaciones con amigos. /messages/:friendId: conversación abierta. */
export default function MessagesPage() {
  const { friendId: param } = useParams();
  const friendId = param ? Number(param) : null;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(() => {
    api.conversations().then((r) => setConversations(r.conversations)).catch(() => {});
  }, []);
  useEffect(loadConversations, [loadConversations]);

  // Abrir conversación: historial + marcar como leída
  useEffect(() => {
    setMessages([]);
    setError('');
    if (!friendId) return;
    api
      .directMessages(friendId)
      .then((r) => {
        setMessages(r.messages);
        return api.markConversationRead(friendId);
      })
      .catch((e) => setError(e.message));
  }, [friendId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  // Tiempo real: mensajes nuevos (del amigo o de mis otras pestañas)
  useSocketEvent<DirectMessage>(
    'dm:new',
    useCallback(
      (m) => {
        const inThisChat = friendId !== null && (m.senderId === friendId || m.recipientId === friendId);
        if (inThisChat) {
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.senderId === friendId) api.markConversationRead(friendId).catch(() => {});
        }
        loadConversations();
      },
      [friendId, loadConversations],
    ),
  );
  useSocketEvent<{ friendId: number }>(
    'dm:read',
    useCallback(
      (p) => {
        loadConversations();
        // El amigo leyó mis mensajes: recargar para mostrar "Leído"
        if (p.friendId === friendId) api.directMessages(friendId).then((r) => setMessages(r.messages)).catch(() => {});
      },
      [friendId, loadConversations],
    ),
  );
  useSocketEvent('friends:changed', loadConversations);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !friendId) return;
    setError('');
    try {
      const { message } = await api.sendDirectMessage(friendId, body);
      setMessages((prev) => (prev.some((x) => x.id === message.id) ? prev : [...prev, message]));
      setText('');
      loadConversations();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const current = conversations?.find((c) => c.friendId === friendId);
  const name = (c: Conversation) => c.realName || c.username;

  return (
    <div className="flex h-full min-h-0">
      {/* Lista de conversaciones (en móvil, solo si no hay una abierta) */}
      <aside
        className={`w-full shrink-0 overflow-y-auto border-celeste-200 bg-surface md:block md:w-80 md:border-r ${friendId ? 'hidden' : 'block'}`}
      >
        <h1 className="px-4 pb-2 pt-5 text-xl font-bold">Mensajes</h1>
        {conversations === null && <p className="px-4 text-sm text-ink-soft">Cargando…</p>}
        {conversations?.length === 0 && (
          <p className="px-4 py-6 text-sm text-ink-soft">
            Todavía no tienes amigos. Agrega a alguien en un videochat para poder escribirle aquí.
          </p>
        )}
        <ul>
          {conversations?.map((c) => (
            <li key={c.friendId}>
              <button
                onClick={() => navigate(`/messages/${c.friendId}`)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-celeste-50 ${c.friendId === friendId ? 'bg-celeste-100' : ''}`}
              >
                <div className="relative">
                  <Avatar avatarUrl={c.avatarUrl} />
                  {!!c.isOnline && <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-400 ring-2 ring-surface" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`truncate ${c.unread ? 'font-bold' : 'font-semibold'}`}>{name(c)}</p>
                    <span className="shrink-0 text-xs text-ink-soft">{time(c.lastAt)}</span>
                  </div>
                  <p className={`truncate text-sm ${c.unread ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
                    {c.lastBody ? `${c.lastSenderId === user?.id ? 'Tú: ' : ''}${c.lastBody}` : 'Escríbele el primer mensaje'}
                  </p>
                </div>
                {c.unread > 0 && (
                  <span className="rounded-full bg-brand-600 px-2 text-xs font-bold text-white">{c.unread}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Conversación */}
      <section className={`min-w-0 flex-1 flex-col ${friendId ? 'flex' : 'hidden md:flex'}`}>
        {!friendId ? (
          <div className="m-auto p-6 text-center text-ink-soft">
            <p className="text-4xl">💬</p>
            <p className="mt-2">Elige una conversación</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-celeste-200 bg-surface px-4 py-3">
              <button onClick={() => navigate('/messages')} className="rounded-lg px-2 py-1 text-ink-soft hover:bg-celeste-100 md:hidden" aria-label="Volver">
                ←
              </button>
              {current && (
                <Link to={`/friends/${current.friendId}`} className="flex min-w-0 items-center gap-3 hover:opacity-80">
                  <Avatar avatarUrl={current.avatarUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{name(current)}</p>
                    <p className="text-xs text-ink-soft">{current.isOnline ? 'En línea' : `@${current.username}`}</p>
                  </div>
                </Link>
              )}
            </header>

            <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4" aria-live="polite">
              {messages.length === 0 && !error && (
                <p className="m-auto text-sm text-ink-soft">Aún no hay mensajes. ¡Saluda! 👋</p>
              )}
              {messages.map((m) => {
                const mine = m.senderId === user?.id;
                return (
                  <div key={m.id} className={`flex max-w-[80%] flex-col ${mine ? 'items-end self-end' : 'items-start self-start'}`}>
                    <p
                      className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                        mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-surface text-ink'
                      }`}
                    >
                      {m.body}
                    </p>
                    <span className="mt-0.5 text-[11px] text-ink-soft">
                      {time(m.createdAt)}
                      {mine && m.readAt && ' · Leído'}
                    </span>
                  </div>
                );
              })}
            </div>

            {error && <p className="mx-4 mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{error}</p>}
            <form onSubmit={send} className="flex gap-2 border-t border-celeste-200 bg-surface p-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_DM_LENGTH}
                placeholder="Escribe un mensaje…"
                aria-label="Mensaje"
                className="min-w-0 flex-1 rounded-xl border border-celeste-300 bg-celeste-50 px-3 py-2.5 text-sm outline-none transition placeholder:text-ink-soft/60 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/25"
              />
              <button
                disabled={!text.trim()}
                className="rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
              >
                Enviar
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
