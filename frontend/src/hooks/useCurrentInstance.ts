import { useInstances } from '@/hooks/useInstances';
import { instancesApi, telemt } from '@/lib/api';

/**
 * Hook to get the current Telemt instance and instance-aware API client.
 * 
 * @example
 * ```ts
 * const { currentInstance, api } = useCurrentInstance();
 * 
 * // Use instance-aware API
 * const users = await api.get('/v1/users');
 * 
 * // Or fall back to legacy API (uses first instance)
 * const users = await telemt.get('/v1/users');
 * ```
 */
export function useCurrentInstance() {
  const { currentInstance, instances, loading, error } = useInstances();
  
  const api = currentInstance
    ? {
        get: <T,>(path: string) => instancesApi.get<T>(currentInstance, path),
        post: <T,>(path: string, body: unknown) =>
          instancesApi.post<T>(currentInstance, path, body),
        patch: <T,>(path: string, body: unknown) =>
          instancesApi.patch<T>(currentInstance, path, body),
        delete: <T,>(path: string) => instancesApi.delete<T>(currentInstance, path),
      }
    : telemt;

  return {
    currentInstance,
    instances,
    loading,
    error,
    api,
    hasInstance: !!currentInstance,
  };
}
