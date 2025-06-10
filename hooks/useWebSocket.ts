import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebSocket(url: string, onMessage: (msg: string) => void) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setIsConnected(true);
    };

    ws.current.onmessage = (event) => {
      onMessage(event.data);
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      console.warn('[WebSocket] Connection closed. Reconnecting in 5s...');
      reconnectRef.current = setTimeout(connect, 5000);
    };

    ws.current.onerror = (err) => {
      console.error('[WebSocket] Error:', err);
      ws.current?.close();
    };
  }, [url, onMessage]);

  useEffect(() => {
    connect();

    return () => {
      ws.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);

  const send = useCallback((msg: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(msg);
    } else {
      console.warn('[WebSocket] Not open. Could not send:', msg);
    }
  }, []);

  return { send, isConnected };
}
