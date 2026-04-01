import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatUptime, formatNumber, formatBytes } from '@/lib/utils';
import { Clock, Users, ArrowUpDown, Globe, Activity, Wifi, WifiOff } from 'lucide-react';
import type { InstanceDashboardData } from '@/hooks/useAllInstancesDashboard';

interface InstanceCardProps {
  instance: InstanceDashboardData;
}

export function InstanceCard({ instance }: InstanceCardProps) {
  const { name, healthy, health, summary, system, totalTraffic, totalActiveIPs, error } = instance;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-3 border-b ${healthy ? 'bg-success/10 border-success/20' : 'bg-danger/10 border-danger/20'}`}>
        <div className="flex items-center gap-2">
          {healthy ? (
            <Wifi size={18} className="text-success" />
          ) : (
            <WifiOff size={18} className="text-danger" />
          )}
          <h3 className="font-semibold text-sm">{name}</h3>
          {health?.read_only && (
            <span className="ml-auto text-xs text-warning bg-warning/15 px-2 py-0.5 rounded">
              READ-ONLY
            </span>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4">
          <div className="text-sm text-danger">{error}</div>
        </div>
      )}

      {/* Content */}
      {!error && summary && (
        <div className="p-4 space-y-4">
          {/* Metric Cards */}
          <div className="grid grid-cols-3 gap-2">
            <MetricCard
              label="Uptime"
              value={formatUptime(summary.uptime_seconds)}
              icon={<Clock size={14} />}
            />
            <MetricCard
              label="Connections"
              value={formatNumber(summary.connections_total)}
              icon={<Activity size={14} />}
              variant="success"
            />
            <MetricCard
              label="Bad Conns"
              value={formatNumber(summary.connections_bad_total)}
              variant={summary.connections_bad_total > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="Users"
              value={summary.configured_users}
              icon={<Users size={14} />}
            />
            <MetricCard
              label="Active IPs"
              value={formatNumber(totalActiveIPs)}
              icon={<Globe size={14} />}
            />
            <MetricCard
              label="Traffic"
              value={formatBytes(totalTraffic)}
              icon={<ArrowUpDown size={14} />}
            />
          </div>

          {/* System Info */}
          {system && Object.keys(system).length > 0 && (
            <div className="border-t pt-3">
              <h4 className="text-xs font-medium text-text-secondary mb-2">System Info</h4>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(system).slice(0, 6).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <div className="text-text-secondary">{key.replace(/_/g, ' ')}</div>
                    <div className="text-text-primary truncate">
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
      )}

      {/* Loading State */}
      {!error && !summary && (
        <div className="p-4 flex items-center justify-center">
          <div className="text-sm text-text-secondary">Loading...</div>
        </div>
      )}
    </div>
  );
}
