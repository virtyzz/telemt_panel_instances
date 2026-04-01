import { useEffect, useState, useCallback } from 'react';
import { useInstances } from '@/hooks/useInstances.tsx';
import { instancesApi } from '@/lib/api';

interface HealthData {
  status: string;
  read_only: boolean;
}

interface SummaryData {
  uptime_seconds: number;
  connections_total: number;
  connections_bad_total: number;
  handshake_timeouts_total: number;
  configured_users: number;
}

interface SystemInfoData {
  [key: string]: unknown;
}

interface GatesData {
  startup_status?: string;
  startup_stage?: string;
  startup_progress_pct?: number;
  [key: string]: unknown;
}

interface UserTrafficData {
  total_octets: number;
  active_unique_ips: number;
}

export interface InstanceDashboardData {
  name: string;
  healthy: boolean;
  health: HealthData | null;
  summary: SummaryData | null;
  system: SystemInfoData | null;
  gates: GatesData | null;
  usersData: UserTrafficData[] | null;
  totalTraffic: number;
  totalActiveIPs: number;
  loading: boolean;
  error: string | null;
}

const ENDPOINTS = ['/v1/health', '/v1/stats/summary', '/v1/system/info', '/v1/runtime/gates'];

export function useAllInstancesDashboard(): {
  instances: InstanceDashboardData[];
  loading: boolean;
  refresh: () => void;
} {
  const { instances: instanceList, refreshInstances } = useInstances();
  const [data, setData] = useState<InstanceDashboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (instanceList.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetchInstanceData = async (instanceName: string): Promise<InstanceDashboardData> => {
      try {
        // Fetch static data via polling-style fetch
        const [healthRes, summaryRes, systemRes, gatesRes, usersRes] = await Promise.all([
          instancesApi.get<HealthData>(instanceName, '/v1/health').catch(() => null),
          instancesApi.get<SummaryData>(instanceName, '/v1/stats/summary').catch(() => null),
          instancesApi.get<SystemInfoData>(instanceName, '/v1/system/info').catch(() => null),
          instancesApi.get<GatesData>(instanceName, '/v1/runtime/gates').catch(() => null),
          instancesApi.get<UserTrafficData[]>(instanceName, '/v1/users').catch(() => null),
        ]);

        const usersData = usersRes || [];
        const totalTraffic = usersData.reduce((sum, u) => sum + u.total_octets, 0);
        const totalActiveIPs = usersData.reduce((sum, u) => sum + u.active_unique_ips, 0);

        return {
          name: instanceName,
          healthy: (healthRes?.status === 'ok') || false,
          health: healthRes,
          summary: summaryRes,
          system: systemRes,
          gates: gatesRes,
          usersData: usersRes,
          totalTraffic,
          totalActiveIPs,
          loading: false,
          error: null,
        };
      } catch (error) {
        return {
          name: instanceName,
          healthy: false,
          health: null,
          summary: null,
          system: null,
          gates: null,
          usersData: null,
          totalTraffic: 0,
          totalActiveIPs: 0,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    };

    Promise.all(instanceList.map(inst => fetchInstanceData(inst.name)))
      .then(results => {
        setData(results);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    // Poll every 10 seconds
    const interval = setInterval(() => {
      Promise.all(instanceList.map(inst => fetchInstanceData(inst.name)))
        .then(results => {
          setData(results);
        });
    }, 10000);

    return () => clearInterval(interval);
  }, [instanceList, refreshKey]);

  return { instances: data, loading, refresh };
}
