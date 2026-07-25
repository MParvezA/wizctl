import { useEffect, useRef, useState } from "react";
import type { BulbState } from "../lib/api";

const RECONNECT_DELAY_MS = 1500;

function wsUrl(ip: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/bulbs/${ip}`;
}

export function useBulbState(ip: string | null) {
  const [state, setState] = useState<BulbState | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ip) {
      setState(null);
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;

    const connect = () => {
      if (cancelled) return;
      socket = new WebSocket(wsUrl(ip));

      socket.onopen = () => setConnected(true);

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as BulbState;
          setState(parsed);
        } catch {
          // ignore malformed frame
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (!cancelled) {
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socket?.close();
    };
  }, [ip]);

  return { state, connected };
}
