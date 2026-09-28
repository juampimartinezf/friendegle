import { io, type Socket } from 'socket.io-client';
import { API_URL, tokenStore } from './api';

let socket: Socket | null = null;
let socketToken: string | null = null;

/**
 * Socket único por pestaña. Se recrea si cambia el token (login/logout)
 * para que el servidor sepa si somos usuario registrado o anónimo.
 */
export function getSocket(): Socket {
  const token = tokenStore.get();
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  socketToken = token;
  const options = { auth: { token }, transports: ['websocket'] };
  socket = API_URL ? io(API_URL, options) : io(options);
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
