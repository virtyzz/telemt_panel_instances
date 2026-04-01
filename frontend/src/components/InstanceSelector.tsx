import { CheckCircle2, CircleX, Loader2 } from 'lucide-react';
import { useInstances } from '@/hooks/useInstances';
import { cn } from '@/lib/utils';

export function InstanceSelector() {
  const { instances, currentInstance, setCurrentInstance, loading, refreshInstances } = useInstances();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-secondary">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Loading instances...</span>
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="text-sm text-text-secondary">
        No instances configured
      </div>
    );
  }

  // If only one instance, just show its status
  if (instances.length === 1) {
    const inst = instances[0];
    return (
      <div className="flex items-center gap-2">
        {inst.healthy ? (
          <CheckCircle2 size={16} className="text-green-500" />
        ) : (
          <CircleX size={16} className="text-red-500" />
        )}
        <span className="text-sm font-medium text-text-primary">{inst.name}</span>
      </div>
    );
  }

  // Multiple instances - show dropdown
  return (
    <div className="relative">
      <select
        value={currentInstance || ''}
        onChange={(e) => setCurrentInstance(e.target.value)}
        className="appearance-none bg-surface hover:bg-surface-hover border border-border rounded-md px-3 py-1.5 pr-8 text-sm text-text-primary cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        {instances.map((inst) => (
          <option key={inst.name} value={inst.name}>
            {inst.name}
          </option>
        ))}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          className="w-4 h-4 text-text-secondary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {/* Status indicator */}
      {currentInstance && (
        <div className="absolute -right-5 top-1/2 -translate-y-1/2">
          {(() => {
            const inst = instances.find((i) => i.name === currentInstance);
            if (!inst) return null;
            return inst.healthy ? (
              <CheckCircle2 size={14} className="text-green-500" />
            ) : (
              <CircleX size={14} className="text-red-500" />
            );
          })()}
        </div>
      )}
    </div>
  );
}
