import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Avatar } from './components/AvatarPicker';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useSocketEvent } from './hooks/useSocket';
import { api, type DirectMessage } from './services/api';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import VideoChatPage from './pages/VideoChatPage';
import ProfilePage from './pages/ProfilePage';
import FriendsPage from './pages/FriendsPage';
import SettingsPage from './pages/SettingsPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import AdminPage from './pages/AdminPage';
import MessagesPage from './pages/MessagesPage';
import { useFriendegleHourReminder } from './components/FriendegleHour';

/** Deja pasar a usuarios registrados o en modo anónimo. */
function RequireSession({ children }: { children: ReactNode }) {
  const { user, isAnonymous, loading } = useAuth();
  if (loading) return <div className="grid h-full place-items-center text-ink-soft">Cargando…</div>;
  if (!user && !isAnonymous) return <Navigate to="/login" replace />;
  return children;
}

function RequireAccount({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/" replace />;
}

/** Solo estética: el servidor responde 404 a quien no sea admin. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user?.isAdmin ? children : <Navigate to="/" replace />;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

type Toast = { text: string; to?: string; avatarUrl?: string | null };

/**
 * Avisos emergentes (los de amigos y mensajes solo llegan a usuarios con cuenta). Vive a nivel de toda la app (también en el videochat,
 * que es donde suelen hacerse amigos). Si el aviso tiene destino, al pulsarlo se abre.
 */
function Notifications() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((t: Toast, ms = 4000) => {
    setToast(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), ms);
  }, []);

  useSocketEvent('friend:request', useCallback(() => show({ text: '🤝 Tienes una nueva solicitud de amistad', to: '/friends' }), [show]));
  useSocketEvent<{ friendId: number; name: string; avatarUrl: string | null }>(
    'friend:new',
    useCallback(
      (f) => show({ text: `🎉 ¡Saluda a tu nuevo amigo ${f.name}!`, to: `/messages/${f.friendId}`, avatarUrl: f.avatarUrl }, 8000),
      [show],
    ),
  );
  useSocketEvent<DirectMessage>(
    'dm:new',
    useCallback(
      (m) => {
        // senderName solo viene en el aviso al destinatario; no avisar si ya tiene esa conversación abierta
        if (!m.senderName || pathname === `/messages/${m.senderId}`) return;
        show({ text: `💬 ${m.senderName}: ${m.body.length > 60 ? m.body.slice(0, 60) + '…' : m.body}`, to: `/messages/${m.senderId}` });
      },
      [show, pathname],
    ),
  );
  // También para anónimos: el aviso de la Hora Friendegle que pidieron
  useFriendegleHourReminder(useCallback(() => show({ text: '🔥 ¡Es la Hora Friendegle! Entra a chatear', to: '/chat' }, 15000), [show]));

  if (!toast) return null;
  const open = () => {
    setToast(null);
    if (toast.to) navigate(toast.to);
  };
  return (
    <button
      onClick={open}
      role="status"
      className="fixed left-1/2 top-4 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl bg-brand-600 px-4 py-3 text-left font-medium text-white shadow-xl shadow-brand-800/20 transition hover:bg-brand-700"
    >
      {toast.avatarUrl && <Avatar avatarUrl={toast.avatarUrl} size="sm" />}
      <span>
        {toast.text}
        {toast.to && <span className="block text-xs font-normal text-white/80">Pulsa para abrir</span>}
      </span>
    </button>
  );
}

function AppLayout() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const refreshRequests = useCallback(() => {
    if (user) api.friendRequests().then((r) => setRequestCount(r.incoming.length)).catch(() => {});
  }, [user]);
  useEffect(refreshRequests, [refreshRequests]);

  const refreshUnread = useCallback(() => {
    if (user)
      api
        .conversations()
        .then((r) => setUnreadMessages(r.conversations.reduce((n, c) => n + c.unread, 0)))
        .catch(() => {});
  }, [user]);
  useEffect(refreshUnread, [refreshUnread]);
  useSocketEvent('dm:new', refreshUnread);
  useSocketEvent('dm:read', refreshUnread);
  useSocketEvent('friend:request', refreshRequests);
  useSocketEvent('friend:accepted', refreshRequests);

  return (
    <div className="flex h-full flex-col">
      <Header onMenu={() => setMenuOpen(!menuOpen)} />
      <div className="relative flex min-h-0 flex-1">
        <div
          className={`absolute inset-y-0 left-0 z-20 transition-transform md:static md:transition-none md:translate-x-0 ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar requestCount={requestCount} unreadMessages={unreadMessages} onNavigate={() => setMenuOpen(false)} />
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <RoutesWithRefresh refresh={refreshRequests} />
        </main>
      </div>
    </div>
  );
}

/** Rutas internas que necesitan el callback de refresco de solicitudes. */
function RoutesWithRefresh({ refresh }: { refresh: () => void }) {
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="profile" element={<RequireAccount><ProfilePage /></RequireAccount>} />
      <Route path="friends" element={<RequireAccount><FriendsPage onRequestsChanged={refresh} /></RequireAccount>} />
      <Route path="friends/:id" element={<RequireAccount><ProfilePage /></RequireAccount>} />
      <Route path="messages" element={<RequireAccount><MessagesPage /></RequireAccount>} />
      <Route path="messages/:friendId" element={<RequireAccount><MessagesPage /></RequireAccount>} />
      <Route path="admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Notifications />
        <Routes>
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
          <Route path="/terminos" element={<TermsPage />} />
          <Route path="/privacidad" element={<PrivacyPage />} />
          <Route path="/chat" element={<RequireSession><VideoChatPage /></RequireSession>} />
          <Route path="/*" element={<RequireSession><AppLayout /></RequireSession>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
