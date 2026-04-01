import { useState, useEffect, useCallback } from 'react';

export type ViewMode = 'single' | 'all';

const STORAGE_KEY = 'telemt_view_mode';

export function useViewMode(defaultMode: ViewMode = 'single') {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY) as ViewMode | null;
      if (stored && (stored === 'single' || stored === 'all')) {
        return stored;
      }
    }
    return defaultMode;
  });

  const setMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }, []);

  return { viewMode, setViewMode: setMode };
}
