import { useEffect, useRef } from 'react';
import { POLL_INTERVAL_MS } from '@/constants/config';
import { useProductStore } from '@/store/productStore';
import type { SyncResponse } from '@/types';

export function useSyncPoller(onSync: (response: SyncResponse) => void) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const poll = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const response = await useProductStore.getState().fetchSync();
        if (cancelled) return;
        const hasEvents =
          response.products.length > 0 ||
          response.categories.length > 0 ||
          response.tags.length > 0;
        if (hasEvents) onSyncRef.current(response);
      } catch {
        // network errors handled silently; next poll will retry
      } finally {
        inFlight = false;
      }
    };

    void poll();
    const intervalId = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);
}
