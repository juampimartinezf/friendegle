import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../services/socket';
import { useAuth } from './useAuth';

/** Devuelve el socket de la sesión actual (registrado o anónimo). */
export function useSocket(): Socket {
  const { user } = useAuth();
  // `user` en deps implícitas: getSocket() se recrea solo si cambió el token
  void user;
  return getSocket();
}

/** Suscribe un handler a un evento del socket mientras el componente está montado. */
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  const socket = useSocket();
  useEffect(() => {
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [socket, event, handler]);
}
