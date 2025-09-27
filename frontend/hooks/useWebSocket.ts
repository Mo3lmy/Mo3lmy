// frontend/hooks/useWebSocket.ts
import { useEffect, useState, useCallback, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';

interface UseWebSocketReturn {
  socket: Socket | null;
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data?: any) => void;
  on: (event: string, handler: (data: any) => void) => void;
  off: (event: string, handler?: (data: any) => void) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const { token } = useAuthStore();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000', {
      auth: {
        token: token || ''
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);
  }, [token]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    }
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }, []);

  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }
  }, []);

  const off = useCallback((event: string, handler?: (data: any) => void) => {
    if (socketRef.current) {
      if (handler) {
        socketRef.current.off(event, handler);
      } else {
        socketRef.current.off(event);
      }
    }
  }, []);

  // Auto-connect when token is available
  useEffect(() => {
    if (token && !socketRef.current?.connected) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return {
    socket: socketRef.current,
    connected,
    connect,
    disconnect,
    emit,
    on,
    off,
  };
}

// Export a singleton instance for global use
let globalSocket: Socket | null = null;

export function getGlobalSocket(): Socket | null {
  if (!globalSocket) {
    const token = localStorage.getItem('token');
    if (token) {
      globalSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000', {
        auth: { token },
        transports: ['websocket', 'polling'],
      });
    }
  }
  return globalSocket;
}

export function disconnectGlobalSocket(): void {
  if (globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
  }
}