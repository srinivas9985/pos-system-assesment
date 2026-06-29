import { create } from 'zustand';
import { api } from '@/services/api';
import {
  loadOrdersCache,
  saveOrdersCache,
  updateOrderInCache,
  upsertOrderInCache,
} from '@/services/orderCache';
import { isNetworkConnected } from '@/services/network';
import { useCartStore } from '@/store/cartStore';
import type { Order } from '@/types';
import { Alert } from 'react-native';

interface OrderState {
  orders: Order[];
  isLoading: boolean;
  fromCache: boolean;
  loadOrders: () => Promise<void>;
  registerOrder: (order: Order) => Promise<void>;
  payOrder: (orderId: number) => Promise<boolean>;
  getOrderById: (orderId: number) => Order | undefined;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  isLoading: false,
  fromCache: false,

  loadOrders: async () => {
    const deviceId = await useCartStore.getState().initDeviceId();
    set({ isLoading: true });

    if (await isNetworkConnected()) {
      try {
        const orders = await api.getOrders(deviceId);
        set({ orders, isLoading: false, fromCache: false });
        await saveOrdersCache(orders);
        return;
      } catch {
        // fall through to cache
      }
    }

    const cached = (await loadOrdersCache()) ?? [];
    set({ orders: cached, isLoading: false, fromCache: true });
  },

  registerOrder: async (order) => {
    set((state) => ({
      orders: [order, ...state.orders.filter((o) => o.id !== order.id)],
      fromCache: false,
    }));
    await upsertOrderInCache(order);
  },

  payOrder: async (orderId) => {
    if (!(await isNetworkConnected())) {
      Alert.alert('Offline', 'Payment requires an internet connection.');
      return false;
    }

    try {
      const result = await api.payOrder(orderId);
      const status = result.order_status as Order['status'];
      set((state) => ({
        orders: state.orders.map((order) =>
          order.id === orderId ? { ...order, status } : order
        ),
        fromCache: false,
      }));
      await updateOrderInCache(orderId, status);
      Alert.alert(
        result.payment_status === 'success' ? 'Payment successful' : 'Payment failed',
        `Order status: ${result.order_status}`
      );
      return true;
    } catch {
      Alert.alert('Error', 'Payment request failed');
      return false;
    }
  },

  getOrderById: (orderId) => get().orders.find((order) => order.id === orderId),
}));
