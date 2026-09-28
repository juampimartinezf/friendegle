import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useSocketEvent } from './hooks/useSocket';
import { api } from './services/api';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import VideoChatPage from './pages/VideoChatPage';
import ProfilePage from './pages/ProfilePage';
import FriendsPage from './pages/FriendsPage';
import SettingsPage from './pages/SettingsPage';

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

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

function Notifications({ onChange }: { onChange: () => void }) {
  const [toast, setToast] = useState<string | null>(null);
  const show = useCallback(
    (text: string) => {
      setToast(text);
      onChange();
      setTimeout(() => setToast(null), 4000);
    },
    [onChange],
  );
  useSocketEvent('friend:request', useCallback(() => show('🤝 Tienes una nueva solicitud de amistad'), [show]));
  useSocketEvent('friend:accepted', useCallback(() => show('🎉 Aceptaron tu solicitud de amistad'), [show]));
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-brand-600 px-4 py-3 font-medium text-white shadow-xl shadow-brand-800/20">{toast}</div>
  );
}

function AppLayout() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [requestCount, setRequestCount] = useState(0);

  const refreshRequests = useCallback(() => {
    if (user) api.friendRequests().then((r) => setRequestCount(r.incoming.length)).catch(() => {});
  }, [user]);
  useEffect(refreshRequests, [refreshRequests]);

  return (
    <div className="flex h-full flex-col">
      <Header onMenu={() => setMenuOpen(!menuOpen)} />
      <div className="relative flex min-h-0 flex-1">
        <div
          className={`absolute inset-y-0 left-0 z-20 transition-transform md:static md:transition-none md:translate-x-0 ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar requestCount={requestCount} onNavigate={() => setMenuOpen(false)} />
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <RoutesWithRefresh refresh={refreshRequests} />
        </main>
      </div>
      {user && <Notifications onChange={refreshRequests} />}
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
          <Route path="/chat" element={<RequireSession><VideoChatPage /></RequireSession>} />
          <Route path="/*" element={<RequireSession><AppLayout /></RequireSession>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
