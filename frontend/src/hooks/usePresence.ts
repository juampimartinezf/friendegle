import { useEffect, useState } from 'react';
import { useSocket } from './useSocket';

/**
 * Personas conectadas ahora, en tiempo real. El servidor solo da el número si son 10 o más:
 * `null` = hay poca gente (se muestra la Hora Friendegle) · `undefined` = aún no se sabe.
 */
export function usePresence(): number | null | undefined {
  const socket = useSocket();
  const [online, setOnline] = useState<number | null>();
  useEffect(() => {
    const onPresence = (p: { online: number | null }) => setOnline(p.online);
    socket.on('presence', onPresence);
    socket.emit('presence:get');
    return () => {
      socket.off('presence', onPresence);
    };
  }, [socket]);
  return online;
}
