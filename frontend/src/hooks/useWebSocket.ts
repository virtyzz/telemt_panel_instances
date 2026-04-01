import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

interface ServerMessage {
  type: 'data' | 'error';
  endpoint: string;
  instance?: string;  // Instance name for multi-instance support
  data?: unknown;
  error?: string;
  timestamp: number;
}

type DataMap = Record<string, unknown>;
type ErrorMap = Record<string, string>;
type Subscriber = { endpoints: string[]; interval: number; instance?: string };

interface WsContextValue {
  data: DataMap;
  errors: ErrorMap;
  connected: boolean;
  subscribe: (id: string, endpoints: string[], interval?: number, instance?: string) => void;
  unsubscribe: (id: string) => void;
  refresh: () => void;
}

export const WsContext = createContext<WsContextValue>({
  data: {},
  errors: {},
  connected: false,
  subscribe: () => {},
  unsubscribe: () => {},
  refresh: () => {},
});

export function useWsProvider(): WsContextValue {
  const [data, setData] = useState<DataMap>({});
  const [errors, setErrors] = useState<ErrorMap>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const subscribers = useRef<Map<string, Subscriber>>(new Map());

  const getAggregated = useCallback(() => {
    const endpointIntervals = new Map<string, { interval: number; instance?: string }>();
    for (const sub of subscribers.current.values()) {
      for (const ep of sub.endpoints) {
        const key = sub.instance ? `${sub.instance}:${ep}` : ep;
        const existing = endpointIntervals.get(key);
        if (!existing || sub.interval < existing.interval) {
          endpointIntervals.set(key, { interval: sub.interval, instance: sub.instance });
        }
      }
    }
    return endpointIntervals;
  }, []);

  const sendSubscriptions = useCallback(() => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return;

    const agg = getAggregated();
    if (agg.size === 0) return;

    // Group by instance and interval
    const byInstanceAndInterval = new Map<string, { endpoints: string[]; interval: number }>();
    for (const [key, { interval, instance }] of agg.entries()) {
      const groupKey = `${instance || 'default'}:${interval}`;
      const existing = byInstanceAndInterval.get(groupKey);
      if (existing) {
        // Add endpoint with instance prefix if needed
        const ep = instance ? `${instance}:${key.split(':')[1] || key}` : key;
        if (!existing.endpoints.includes(ep)) {
          existing.endpoints.push(ep);
        }
      } else {
        const ep = instance ? `${instance}:${key.split(':')[1] || key}` : key;
        byInstanceAndInterval.set(groupKey, { endpoints: [ep], interval });
      }
    }

    // Send all subscriptions (server will use the last one)
    // Note: Server currently handles one subscription at a time
    // Send the combined list of all endpoints
    const allEndpoints: string[] = [];
    let minInterval = Number.MAX_SAFE_INTEGER;
    for (const group of byInstanceAndInterval.values()) {
      allEndpoints.push(...group.endpoints);
      if (group.interval < minInterval) {
        minInterval = group.interval;
      }
    }

    if (allEndpoints.length > 0) {
      ws.send(JSON.stringify({
        type: 'subscribe',
        endpoints: allEndpoints,
        interval: minInterval,
      }));
    }
  }, [getAggregated]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const base = (window as any).__BASE_PATH__ || '';
    const ws = new WebSocket(`${proto}//${window.location.host}${base}/api/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      sendSubscriptions();
    };

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);
      // Create unique key for data map
      const key = msg.instance ? `${msg.instance}:${msg.endpoint}` : msg.endpoint;
      
      if (msg.type === 'data') {
        setData(prev => ({ ...prev, [key]: msg.data }));
        setErrors(prev => {
          if (!prev[key]) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } else if (msg.type === 'error') {
        setErrors(prev => ({ ...prev, [key]: msg.error || 'unknown error' }));
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, [sendSubscriptions]);

  // Connect once on mount
  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback((id: string, endpoints: string[], interval = 5, instance?: string) => {
    subscribers.current.set(id, { endpoints, interval, instance });
    sendSubscriptions();
  }, [sendSubscriptions]);

  const unsubscribe = useCallback((id: string) => {
    subscribers.current.delete(id);
    sendSubscriptions();
  }, [sendSubscriptions]);

  const refresh = useCallback(() => {
    sendSubscriptions();
  }, [sendSubscriptions]);

  return { data, errors, connected, subscribe, unsubscribe, refresh };
}

// Hook for pages to subscribe to specific endpoints
export function useWsSubscription(id: string, endpoints: string[], interval = 5, instance?: string) {
  const ctx = useContext(WsContext);
  const endpointsKey = endpoints.join(',');

  useEffect(() => {
    ctx.subscribe(id, endpoints, interval, instance);
    return () => ctx.unsubscribe(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, endpointsKey, interval, instance]);

  return {
    data: ctx.data,
    errors: ctx.errors,
    connected: ctx.connected,
    refresh: ctx.refresh,
  };
}

// Helper to get typed data from the map
export function useEndpoint<T>(dataMap: DataMap, endpoint: string, instance?: string): T | null {
  const key = instance ? `${instance}:${endpoint}` : endpoint;
  return (dataMap[key] as T) ?? null;
}
