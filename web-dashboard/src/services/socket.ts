import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const connectSocket = (token: string): Socket => {
  if (socket?.connected) return socket;

  socket = io('/', {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (): Socket | null => socket;

// Subscription helpers
export const subscribeToMap = (region: { x: number; y: number; size: number }) => {
  socket?.emit('subscribe:map', region);
};

export const unsubscribeFromMap = (region: { x: number; y: number; size: number }) => {
  socket?.emit('unsubscribe:map', region);
};

export const subscribeToMarches = () => {
  socket?.emit('subscribe:marches');
};

export const unsubscribeFromMarches = () => {
  socket?.emit('unsubscribe:marches');
};

export const subscribeToConquest = () => {
  socket?.emit('subscribe:conquest');
};

export const unsubscribeFromConquest = () => {
  socket?.emit('unsubscribe:conquest');
};
