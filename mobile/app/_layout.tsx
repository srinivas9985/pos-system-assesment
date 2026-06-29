import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { SyncManager } from '@/components/SyncManager';
import { API_URL } from '@/constants/config';
import { useCartStore } from '@/store/cartStore';
import { useOrderStore } from '@/store/orderStore';

export default function RootLayout() {
  const initDeviceId = useCartStore((s) => s.initDeviceId);

  useEffect(() => {
    initDeviceId().then(() => {
      void useCartStore.getState().loadCart();
      void useOrderStore.getState().loadOrders();
    });
    if (__DEV__) {
      console.log('[POS] API_URL:', API_URL);
    }
  }, [initDeviceId]);

  return (
    <>
      <SyncManager />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ title: 'Product Detail' }} />
        <Stack.Screen name="order/[id]" options={{ title: 'Order' }} />
      </Stack>
    </>
  );
}
