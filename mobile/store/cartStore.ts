import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';
import type { Cart } from '@/types';
import { Alert } from 'react-native';

const DEVICE_ID_KEY = 'surat_device_id';

function generateDeviceId(): string {
  return `device_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

let deviceIdPromise: Promise<string> | null = null;

interface CartState {
  cart: Cart | null;
  deviceId: string;
  isLoading: boolean;
  initDeviceId: () => Promise<string>;
  loadCart: () => Promise<void>;
  addItem: (productId: number, quantity: number, note?: string, scheduledDelivery?: string) => Promise<void>;
  removeItem: (productId: number) => Promise<void>;
  updateItem: (productId: number, quantity: number, note?: string) => Promise<void>;
}

export const useCartStore = create<CartState>((set, get) => {
  const ensureDeviceId = async (): Promise<string> => {
    const { deviceId } = get();
    if (deviceId) return deviceId;

    if (!deviceIdPromise) {
      deviceIdPromise = (async () => {
        const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
        const id = stored ?? generateDeviceId();
        if (!stored) {
          await AsyncStorage.setItem(DEVICE_ID_KEY, id);
        }
        set({ deviceId: id });
        return id;
      })();
    }

    return deviceIdPromise;
  };

  return {
  cart: null,
  deviceId: '',
  isLoading: false,

  initDeviceId: ensureDeviceId,

  loadCart: async () => {
    const deviceId = await ensureDeviceId();
    set({ isLoading: true });
    try {
      const cart = await api.cartAction({ action: 'list', device_id: deviceId });
      set({ cart, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addItem: async (productId, quantity, note, scheduledDelivery) => {
    const deviceId = await ensureDeviceId();
    try {
      const cart = await api.cartAction({
        action: 'add',
        product_id: productId,
        quantity,
        note,
        scheduled_delivery: scheduledDelivery,
        device_id: deviceId,
      });
      set({ cart });
    } catch {
      Alert.alert('Error', 'Could not add item to cart.');
    }
  },

  removeItem: async (productId) => {
    const deviceId = await ensureDeviceId();
    try {
      const cart = await api.cartAction({
        action: 'remove',
        product_id: productId,
        device_id: deviceId,
      });
      set({ cart });
    } catch {
      Alert.alert('Error', 'Could not remove item from cart.');
    }
  },

  updateItem: async (productId, quantity, note) => {
    const deviceId = await ensureDeviceId();
    try {
      const cart = await api.cartAction({
        action: 'update',
        product_id: productId,
        quantity,
        note,
        device_id: deviceId,
      });
      set({ cart });
    } catch {
      Alert.alert('Error', 'Could not update item in cart.');
    }
  },
};
});
