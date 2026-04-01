import { useState, useEffect, useCallback } from 'react';
import { useInstances } from '@/hooks/useInstances.tsx';
import { instancesApi } from '@/lib/api';

export interface UserInfo {
  username: string;
  instanceName?: string;  // Added for multi-instance support
  user_ad_tag?: string;
  max_tcp_conns?: number;
  expiration_rfc3339?: string;
  data_quota_bytes?: number;
  max_unique_ips?: number;
  current_connections: number;
  active_unique_ips: number;
  recent_unique_ips: number;
  total_octets: number;
  active_unique_ips_list?: string[];
  recent_unique_ips_list?: string[];
  links?: {
    classic?: string[];
    secure?: string[];
    tls?: string[];
  };
}

export interface AllInstancesUsersData {
  users: UserInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAllInstancesUsers(): AllInstancesUsersData {
  const { instances: instanceList } = useInstances();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (instanceList.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const fetchUsers = async () => {
      try {
        const results = await Promise.all(
          instanceList.map(async (inst) => {
            try {
              const users = await instancesApi.get<UserInfo[]>(inst.name, '/v1/users');
              // Add instance name to each user
              return (users || []).map(u => ({ ...u, instanceName: inst.name }));
            } catch {
              return [];
            }
          })
        );
        // Flatten all users
        const allUsers = results.flat();
        setUsers(allUsers);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();

    // Poll every 15 seconds
    const interval = setInterval(() => {
      fetchUsers();
    }, 15000);

    return () => clearInterval(interval);
  }, [instanceList, refreshKey]);

  return { users, loading, error, refresh };
}
