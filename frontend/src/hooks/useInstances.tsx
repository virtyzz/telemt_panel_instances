import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

export interface TelemtInstance {
  name: string;
  url: string;
  healthy: boolean;
}

interface InstanceContextValue {
  instances: TelemtInstance[];
  currentInstance: string | null;
  setCurrentInstance: (name: string) => void;
  loading: boolean;
  error: string | null;
  refreshInstances: () => void;
}

export const InstanceContext = createContext<InstanceContextValue>({
  instances: [],
  currentInstance: null,
  setCurrentInstance: () => {},
  loading: false,
  error: null,
  refreshInstances: () => {},
});

const INSTANCES_KEY = 'telemt_current_instance';

export function InstanceProvider({ children }: { children: ReactNode }) {
  const [instances, setInstances] = useState<TelemtInstance[]>([]);
  const [currentInstance, setCurrentInstanceState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstances = useCallback(async () => {
    try {
      const BASE = (window as any).__BASE_PATH__ || '';
      const response = await fetch(`${BASE}/api/instances`, {
        credentials: 'same-origin',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const json = await response.json();
      if (!json.ok) {
        throw new Error(json.error?.message || 'Failed to fetch instances');
      }
      
      setInstances(json.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  // Set current instance from localStorage or default to first
  useEffect(() => {
    if (!loading && instances.length > 0) {
      const stored = localStorage.getItem(INSTANCES_KEY);
      const exists = instances.find(inst => inst.name === stored);
      
      if (exists) {
        setCurrentInstanceState(stored);
      } else {
        // Default to first instance
        setCurrentInstanceState(instances[0].name);
      }
    }
  }, [loading, instances]);

  const setCurrentInstance = useCallback((name: string) => {
    setCurrentInstanceState(name);
    localStorage.setItem(INSTANCES_KEY, name);
  }, []);

  const value: InstanceContextValue = {
    instances,
    currentInstance,
    setCurrentInstance,
    loading,
    error,
    refreshInstances: fetchInstances,
  };

  return (
    <InstanceContext.Provider value={value}>
      {children}
    </InstanceContext.Provider>
  );
}

export function useInstances() {
  const context = useContext(InstanceContext);
  if (!context) {
    throw new Error('useInstances must be used within an InstanceProvider');
  }
  return context;
}
