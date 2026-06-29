import { useCallback, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useCartStore } from '@/store/cartStore';
import { useOrderStore } from '@/store/orderStore';
import { useProductStore } from '@/store/productStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useSyncPoller } from '@/hooks/useSyncPoller';
import { useAppState } from '@/hooks/useAppState';
import type { SyncEvent } from '@/types';

/** Global sync: WebSocket events, foreground refresh, periodic polling, and reconnect. */
export function SyncManager() {
  const applySyncEvent = useProductStore((s) => s.applySyncEvent);
  const applySync = useProductStore((s) => s.applySync);
  const runSync = useProductStore((s) => s.runSync);
  const loadTags = useProductStore((s) => s.loadTags);
  const refreshSilently = useProductStore((s) => s.refreshSilently);

  useEffect(() => {
    loadTags();
    runSync();
  }, [loadTags, runSync]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        refreshSilently();
        void useCartStore.getState().syncWithServer();
        void useOrderStore.getState().loadOrders();
      }
    });
    return () => unsubscribe();
  }, [refreshSilently]);

  const handleWsMessage = useCallback(
    (event: SyncEvent) => {
      applySyncEvent(event);
    },
    [applySyncEvent]
  );

  const handleForeground = useCallback(() => {
    refreshSilently();
  }, [refreshSilently]);

  const handlePollSync = useCallback(
    (response: Parameters<typeof applySync>[0]) => {
      applySync(response);
    },
    [applySync]
  );

  useWebSocket(handleWsMessage);
  useAppState(handleForeground);
  useSyncPoller(handlePollSync);

  return null;
}
