import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, parseDbDate, type Friend, type FriendRequest } from '../services/api';
import { useSocketEvent } from '../hooks/useSocket';
import UserCard from '../components/UserCard';

export default function FriendsPage({ onRequestsChanged }: { onRequestsChanged: () => void }) {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState(0);

  const load = useCallback(async () => {
    const [f, r] = await Promise.all([api.friends(), api.friendRequests()]);
    setFriends(f.friends);
    setRequests(r.incoming);
    setOutgoing(r.outgoingCount);
    onRequestsChanged();
  }, [onRequestsChanged]);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent('friend:request', load);
  useSocketEvent('friend:accepted', load);
  useSocketEvent('friends:changed', load);

  async function respond(id: number, accept: boolean) {
    await (accept ? api.acceptRequest(id) : api.rejectRequest(id));
    load();
  }

  async function remove(f: Friend) {
    if (!confirm(`¿Eliminar a ${f.realName || f.username} de tus amigos?`)) return;
    await api.removeFriend(f.friendshipId);
    load();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      {requests.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Solicitudes recibidas</h2>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-celeste-300 bg-celeste-50 p-3">
                <div className="grid size-12 place-items-center rounded-full bg-celeste-200 text-2xl">🎭</div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-semibold">{r.label ?? 'User_????'}</p>
                  <p className="text-xs text-ink-soft">
                    Te conociste en un chat · {parseDbDate(r.createdAt)?.toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => respond(r.id, true)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500">
                  Aceptar
                </button>
                <button onClick={() => respond(r.id, false)} className="rounded-lg px-3 py-1.5 text-sm text-ink hover:bg-celeste-100">
                  Rechazar
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">Su perfil real se revela solo si aceptas.</p>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">Mis amigos</h1>
          {outgoing > 0 && <span className="text-xs text-ink-soft">{outgoing} solicitud(es) enviada(s) pendiente(s)</span>}
        </div>
        {friends === null ? (
          <p className="text-ink-soft">Cargando…</p>
        ) : friends.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-celeste-300 p-10 text-center text-ink-soft">
            <p className="text-4xl">🤝</p>
            <p className="mt-3">Aún no tienes amigos.</p>
            <p className="text-sm">Inicia un chat y pulsa “Agregar amigo” si conectan.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <UserCard
                key={f.id}
                name={f.realName || f.username}
                avatarUrl={f.avatarUrl}
                isOnline={f.isOnline}
                lastSeen={f.lastSeen}
                onClick={() => navigate(`/friends/${f.id}`)}
                actions={
                  <button onClick={() => remove(f)} className="rounded-lg px-2 py-1 text-xs text-ink-soft hover:bg-celeste-100 hover:text-rose-600">
                    Eliminar
                  </button>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
