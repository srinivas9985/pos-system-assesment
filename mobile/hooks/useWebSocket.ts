import { useEffect, useRef } from 'react';
import { WS_URL } from '@/constants/config';
import type { SyncEvent } from '@/types';

const RECONNECT_MS = 3000;

export function useWebSocket(
  onMessage: (event: SyncEvent) => void,
  onConnectionChange?: (connected: boolean) => void
) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onConnectionChangeRef = useRef(onConnectionChange);
  onConnectionChangeRef.current = onConnectionChange;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const disposeSocket = (socket: WebSocket | null) => {
      if (!socket) return;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };

    const connect = () => {
      if (closed) return;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      disposeSocket(ws);
      ws = new WebSocket(`${WS_URL}/ws`);

      ws.onopen = () => {
        onConnectionChangeRef.current?.(true);
      };

      ws.onmessage = (e) => {
        try {
          const event: SyncEvent = JSON.parse(e.data);
          onMessageRef.current(event);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onclose = () => {
        onConnectionChangeRef.current?.(false);
        if (!closed) {
          reconnectTimer = setTimeout(connect, RECONNECT_MS);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      disposeSocket(ws);
      ws = null;
      onConnectionChangeRef.current?.(false);
    };
  }, []);
}
