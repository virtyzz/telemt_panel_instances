import { Header } from '@/components/layout/Header';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import { ErrorAlert } from '@/components/ErrorAlert';
import { StartupStatus } from '@/components/StartupStatus';
import { useWsSubscription, useEndpoint } from '@/hooks/useWebSocket';
import { usePolling } from '@/hooks/usePolling';
import { telemt, instancesApi } from '@/lib/api';
import { useCurrentInstance } from '@/hooks/useCurrentInstance';
import { useInstances } from '@/hooks/useInstances.tsx';
import { useAllInstancesDashboard } from '@/hooks/useAllInstancesDashboard';
import { useViewMode } from '@/hooks/useViewMode';
import { InstanceCard } from '@/components/InstanceCard';
import { formatUptime, formatNumber, formatBytes } from '@/lib/utils';
import { Activity, Wifi, WifiOff, Clock, Users, ArrowUpDown, Globe, LayoutGrid, List } from 'lucide-react';
import { useMemo } from 'react';

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

const ENDPOINTS = ['/v1/health', '/v1/stats/summary', '/v1/system/info', '/v1/runtime/gates'];

export function DashboardPage() {
  const { viewMode, setViewMode } = useViewMode('single');
  const { currentInstance, api, hasInstance, loading: instanceLoading } = useCurrentInstance();
  const { instances: instanceList } = useInstances();
  const allInstancesData = useAllInstancesDashboard();

  // Single instance mode (existing behavior)
  const { data: wsData, errors, connected, refresh } = useWsSubscription('dashboard', ENDPOINTS, 5, currentInstance || undefined);

  const health = useEndpoint<HealthData>(wsData, '/v1/health', currentInstance || undefined);
  const summary = useEndpoint<SummaryData>(wsData, '/v1/stats/summary', currentInstance || undefined);
  const system = useEndpoint<SystemInfoData>(wsData, '/v1/system/info', currentInstance || undefined);
  const gates = useEndpoint<GatesData>(wsData, '/v1/runtime/gates', currentInstance || undefined);

  const { data: usersData } = usePolling<UserTrafficData[]>(
    () => api.get('/v1/users'),
    10000
  );

  const totalTraffic = useMemo(() => {
    if (!usersData) return 0;
    return usersData.reduce((sum, u) => sum + u.total_octets, 0);
  }, [usersData]);

  const totalActiveIPs = useMemo(() => {
    if (!usersData) return 0;
    return usersData.reduce((sum, u) => sum + u.active_unique_ips, 0);
  }, [usersData]);

  const isHealthy = health?.status === 'ok';
  const firstError = Object.values(errors)[0];

  // Show loading state while instance is being selected
  if (instanceLoading) {
    return (
      <div>
        <Header title="Dashboard" />
        <div className="p-4 lg:p-6 flex items-center justify-center">
          <div className="text-text-secondary">Loading instance data...</div>
        </div>
      </div>
    );
  }

  // All instances view
  if (viewMode === 'all') {
    return (
      <div>
        <Header
          title="Dashboard"
          refreshing={!allInstancesData.loading}
          onRefresh={allInstancesData.refresh}
          extraAction={
            <button
              onClick={() => setViewMode('single')}
              className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
              title="Switch to single instance view"
            >
              <List size={18} className="text-text-secondary" />
            </button>
          }
        />

        <div className="p-4 lg:p-6">
          {/* View mode toggle info */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <LayoutGrid size={16} />
              <span>Showing all {instanceList.length} instance(s)</span>
            </div>
            <div className="text-xs text-text-secondary">
              Mode auto-saves per device
            </div>
          </div>

          {/* Instance cards grid */}
          {allInstancesData.loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-text-secondary">Loading all instances...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
              {allInstancesData.instances.map(instance => (
                <InstanceCard key={instance.name} instance={instance} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Single instance view (existing behavior)
  return (
    <div>
      <Header 
        title="Dashboard" 
        refreshing={!connected} 
        onRefresh={refresh}
        extraAction={
          instanceList.length > 1 && (
            <button
              onClick={() => setViewMode('all')}
              className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
              title="View all instances"
            >
              <LayoutGrid size={18} className="text-text-secondary" />
            </button>
          )
        }
      />

      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        {firstError && <ErrorAlert message={firstError} onRetry={refresh} />}

        {/* Health Banner */}
        <div
          className={`rounded-lg border p-3 lg:p-4 flex items-center gap-2 lg:gap-3 text-sm lg:text-base ${
            isHealthy
              ? 'bg-success/10 border-success/30'
              : 'bg-danger/10 border-danger/30'
          }`}
        >
          {isHealthy ? (
            <Wifi size={18} className="text-success shrink-0" />
          ) : (
            <WifiOff size={18} className="text-danger shrink-0" />
          )}
          <span className={`font-medium ${isHealthy ? 'text-success' : 'text-danger'}`}>
            {isHealthy ? 'Telemt is running' : 'Telemt is unreachable'}
          </span>
          {!connected && (
            <span className="ml-auto text-xs text-warning bg-warning/15 px-2 py-1 rounded shrink-0">
              WS reconnecting...
            </span>
          )}
          {health?.read_only && (
            <span className="ml-auto text-xs text-warning bg-warning/15 px-2 py-1 rounded shrink-0">
              READ-ONLY
            </span>
          )}
        </div>

        {/* Startup Status */}
        {gates && (
          <StartupStatus
            status={gates.startup_status}
            stage={gates.startup_stage}
            progressPct={gates.startup_progress_pct}
          />
        )}

        {/* Metric Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 lg:gap-4">
            <MetricCard
              label="Uptime"
              value={formatUptime(summary.uptime_seconds)}
              icon={<Clock size={14} className="lg:w-4 lg:h-4" />}
            />
            <MetricCard
              label="Total Connections"
              value={formatNumber(summary.connections_total)}
              icon={<Activity size={14} className="lg:w-4 lg:h-4" />}
              variant="success"
            />
            <MetricCard
              label="Bad Connections"
              value={formatNumber(summary.connections_bad_total)}
              variant={summary.connections_bad_total > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="Configured Users"
              value={summary.configured_users}
              icon={<Users size={14} className="lg:w-4 lg:h-4" />}
            />
            <MetricCard
              label="Active IPs"
              value={formatNumber(totalActiveIPs)}
              icon={<Globe size={14} className="lg:w-4 lg:h-4" />}
            />
            <MetricCard
              label="Total Traffic"
              value={formatBytes(totalTraffic)}
              icon={<ArrowUpDown size={14} className="lg:w-4 lg:h-4" />}
            />
          </div>
        )}

        {/* System Info */}
        {system && (
          <div className="bg-surface border border-border rounded-lg p-3 lg:p-4">
            <h3 className="text-xs lg:text-sm font-medium text-text-secondary mb-2 lg:mb-3">System Info {currentInstance ? `- ${currentInstance}` : ''}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 lg:gap-3">
              {Object.entries(system).map(([key, value]) => (
                <div key={key}>
                  <div className="text-xs text-text-secondary">{key.replace(/_/g, ' ')}</div>
                  <div className="text-xs lg:text-sm text-text-primary truncate">
                    {typeof value === 'boolean' ? (
                      <StatusBadge status={value} />
                    ) : (
                      String(value ?? '-')
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
