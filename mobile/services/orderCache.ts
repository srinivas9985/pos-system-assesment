import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Order } from '@/types';

const ORDERS_CACHE_KEY = 'surat_cache_orders';

export async function saveOrdersCache(orders: Order[]): Promise<void> {
  await AsyncStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(orders));
}

export async function loadOrdersCache(): Promise<Order[] | null> {
  const raw = await AsyncStorage.getItem(ORDERS_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Order[];
  } catch {
    return null;
  }
}

export async function upsertOrderInCache(order: Order): Promise<void> {
  const existing = (await loadOrdersCache()) ?? [];
  const next = [order, ...existing.filter((o) => o.id !== order.id)];
  await saveOrdersCache(next);
}

export async function updateOrderInCache(
  orderId: number,
  status: Order['status']
): Promise<void> {
  const existing = (await loadOrdersCache()) ?? [];
  const next = existing.map((order) =>
    order.id === orderId ? { ...order, status } : order
  );
  await saveOrdersCache(next);
}
