import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Pencil, Trash2, Check, Wifi, WifiOff, Server } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import type { UserInfo, UserLinks } from '@/pages/UsersPage';

interface UserCardProps {
  user: UserInfo & { instanceName?: string };
  onEdit: (username: string, instanceName?: string) => void;
  onDelete: (username: string, instanceName?: string) => void;
  onCopy: (text: string, label?: string) => void;
}

function collectLinksFlat(links?: UserLinks): Array<{ url: string; label: string }> {
  const result: Array<{ url: string; label: string }> = [];
  if (!links) return result;
  if (links.classic) links.classic.forEach((url: string) => result.push({ url, label: 'Classic' }));
  if (links.secure) links.secure.forEach((url: string) => result.push({ url, label: 'Secure' }));
  if (links.tls) links.tls.forEach((url: string) => result.push({ url, label: 'TLS' }));
  return result;
}

export function UserCard({ user, onEdit, onDelete, onCopy }: UserCardProps) {
  const [showIPs, setShowIPs] = useState(false);
  const links = collectLinksFlat(user.links);
  const isExpired = user.expiration_rfc3339 && new Date(user.expiration_rfc3339) < new Date();
  const hasActiveIPs = (user.active_unique_ips_list?.length || 0) > 0;

  return (
    <div className={`bg-surface border rounded-lg overflow-hidden ${isExpired ? 'border-danger/50' : 'border-border'}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center gap-2 ${isExpired ? 'bg-danger/10 border-danger/20' : 'bg-surface-hover border-border'}`}>
        {user.current_connections > 0 ? (
          <Wifi size={16} className="text-success" />
        ) : (
          <WifiOff size={16} className="text-text-secondary" />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{user.username}</h3>
          {user.instanceName && (
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <Server size={10} />
              <span className="truncate">{user.instanceName}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(user.username, user.instanceName)}
            className="p-1.5 hover:bg-surface-hover rounded transition-colors"
            title="Edit user"
          >
            <Pencil size={14} className="text-text-secondary" />
          </button>
          <button
            onClick={() => onDelete(user.username, user.instanceName)}
            className="p-1.5 hover:bg-danger/20 rounded transition-colors"
            title="Delete user"
          >
            <Trash2 size={14} className="text-danger" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-text-secondary">Connections</div>
            <div className="font-medium">{user.current_connections}</div>
          </div>
          <div>
            <div className="text-text-secondary">Active IPs</div>
            <div className="font-medium">{user.active_unique_ips}</div>
          </div>
          <div>
            <div className="text-text-secondary">Traffic</div>
            <div className="font-medium">{formatBytes(user.total_octets)}</div>
          </div>
          <div>
            <div className="text-text-secondary">Max IPs</div>
            <div className="font-medium">{user.max_unique_ips || '∞'}</div>
          </div>
        </div>

        {/* Expiration */}
        {user.expiration_rfc3339 && (
          <div className="text-xs">
            <div className="text-text-secondary">Expires</div>
            <div className={`font-medium ${isExpired ? 'text-danger' : 'text-text-primary'}`}>
              {isExpired ? 'Expired' : new Date(user.expiration_rfc3339).toLocaleDateString()}
            </div>
          </div>
        )}

        {/* Links */}
        {links.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-text-secondary">Subscription Links</div>
            <div className="flex flex-wrap gap-1">
              {links.slice(0, 3).map((link, idx) => (
                <button
                  key={idx}
                  onClick={() => onCopy(link.url, `${link.label} link`)}
                  className="px-2 py-0.5 text-xs bg-surface-hover rounded hover:bg-surface-hover/80 transition-colors truncate max-w-[120px]"
                  title={link.url}
                >
                  {link.label}
                </button>
              ))}
              {links.length > 3 && (
                <Badge variant="default">+{links.length - 3}</Badge>
              )}
            </div>
          </div>
        )}

        {/* IP List Toggle */}
        {hasActiveIPs && (
          <div>
            <button
              onClick={() => setShowIPs(!showIPs)}
              className="text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              {showIPs ? 'Hide' : 'Show'} active IPs ({user.active_unique_ips_list?.length})
            </button>
            {showIPs && user.active_unique_ips_list && (
              <div className="mt-2 text-xs text-text-secondary break-all max-h-32 overflow-y-auto">
                {user.active_unique_ips_list.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Quota */}
        {user.data_quota_bytes && (
          <div className="text-xs">
            <div className="text-text-secondary">Data Quota</div>
            <div className="font-medium">{formatBytes(user.data_quota_bytes)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
