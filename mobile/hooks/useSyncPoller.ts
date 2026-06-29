import { useEffect, useRef } from 'react';
import { POLL_INTERVAL_MS } from '@/constants/config';
import { useProductStore } from '@/store/productStore';
import type { SyncResponse } from '@/types';

export function useSyncPoller(onSync: (response: SyncResponse) => void) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    const poll = async () => {
      try {
        const response = await useProductStore.getState().fetchSync();
        const hasEvents =
          response.products.length > 0 ||
          response.categories.length > 0 ||
          response.tags.length > 0;
        if (hasEvents) onSyncRef.current(response);
      } catch {
        // network errors handled silently; next poll will retry
      }
    };

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []);
}
