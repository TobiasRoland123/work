import { useEffect, useRef } from 'react';

export function useWebSocket(url: string, onMessage: (msg: string) => void) {
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    ws.current = new WebSocket(url);

    ws.current.onmessage = (event) => {
      onMessage(event.data);
    };

    return () => {
      ws.current?.close();
    };
  }, [url, onMessage]);

  const send = (msg: string) => {
    ws.current?.send(msg);
  };

  return { send };
}
