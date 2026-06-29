import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';
import { loadCartCache, saveCartCache } from '@/services/cartCache';
import { loadProductsCache } from '@/services/cache';
import { isNetworkConnected } from '@/services/network';
import { useProductStore } from '@/store/productStore';
import type { Cart, CartItem, Order, Product } from '@/types';

const DEVICE_ID_KEY = 'surat_device_id';

function generateDeviceId(): string {
  return `device_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

let deviceIdPromise: Promise<string> | null = null;

async function findProduct(productId: number): Promise<Product | undefined> {
  const fromStore = useProductStore.getState().products.find((p) => p.id === productId);
  if (fromStore) return fromStore;
  const cached = await loadProductsCache();
  return cached?.find((p) => p.id === productId);
}

function emptyCart(deviceId: string): Cart {
  return {
    id: 0,
    device_id: deviceId,
    created_at: new Date().toISOString(),
    items: [],
  };
}

function applyLocalAdd(
  cart: Cart,
  productId: number,
  quantity: number,
  note?: string,
  scheduledDelivery?: string,
  product?: Product
): Cart {
  const items = [...(cart.items ?? [])];
  const existing = items.find((item) => item.product_id === productId);
  if (existing) {
    existing.quantity += quantity;
    if (note !== undefined) existing.note = note;
    if (scheduledDelivery !== undefined) existing.scheduled_delivery = scheduledDelivery;
    if (product) existing.product = product;
  } else {
    items.push({
      id: -productId,
      cart_id: cart.id,
      product_id: productId,
      quantity,
      note,
      scheduled_delivery: scheduledDelivery,
      product,
    });
  }
  return { ...cart, items };
}

function applyLocalRemove(cart: Cart, productId: number): Cart {
  return {
    ...cart,
    items: (cart.items ?? []).filter((item) => item.product_id !== productId),
  };
}

function applyLocalUpdate(
  cart: Cart,
  productId: number,
  quantity: number,
  note?: string
): Cart {
  return {
    ...cart,
    items: (cart.items ?? []).map((item) =>
      item.product_id === productId ? { ...item, quantity, note } : item
    ),
  };
}

function buildCartPayload(
  action: 'add' | 'update',
  deviceId: string,
  item: CartItem
): Parameters<typeof api.cartAction>[0] {
  const payload: Parameters<typeof api.cartAction>[0] = {
    action,
    product_id: item.product_id,
    quantity: item.quantity,
    device_id: deviceId,
  };
  if (item.note) payload.note = item.note;
  if (item.scheduled_delivery) payload.scheduled_delivery = item.scheduled_delivery;
  return payload;
}

interface CartState {
  cart: Cart | null;
  deviceId: string;
  isLoading: boolean;
  fromCache: boolean;
  initDeviceId: () => Promise<string>;
  loadCart: () => Promise<void>;
  syncWithServer: () => Promise<boolean>;
  placeOrder: () => Promise<Order>;
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

  const persistLocalCart = async (cart: Cart) => {
    set({ cart, fromCache: true });
    await saveCartCache(cart);
  };

  const applyServerCart = async (cart: Cart) => {
    set({ cart, fromCache: false });
    await saveCartCache(cart);
  };

  const syncWithServer = async (): Promise<boolean> => {
    if (!(await isNetworkConnected())) return false;

    const deviceId = await ensureDeviceId();
    const local = get().cart ?? (await loadCartCache());
    if (!local?.items?.length) {
      try {
        const cart = await api.cartAction({ action: 'list', device_id: deviceId });
        await applyServerCart(cart);
        return true;
      } catch {
        return false;
      }
    }

    try {
      let serverItems: CartItem[] = [];
      try {
        const serverCart = await api.cartAction({ action: 'list', device_id: deviceId });
        serverItems = serverCart.items ?? [];
      } catch {
        serverItems = [];
      }

      const serverByProduct = new Map(serverItems.map((item) => [item.product_id, item]));
      const localByProduct = new Map((local.items ?? []).map((item) => [item.product_id, item]));

      for (const item of local.items ?? []) {
        const onServer = serverByProduct.get(item.product_id);
        if (!onServer) {
          await api.cartAction(buildCartPayload('add', deviceId, item));
        } else if (onServer.quantity !== item.quantity || onServer.note !== item.note) {
          await api.cartAction(buildCartPayload('update', deviceId, item));
        }
      }

      for (const item of serverItems) {
        if (!localByProduct.has(item.product_id)) {
          await api.cartAction({
            action: 'remove',
            product_id: item.product_id,
            device_id: deviceId,
          });
        }
      }

      const fresh = await api.cartAction({ action: 'list', device_id: deviceId });
      await applyServerCart(fresh);
      return (fresh.items?.length ?? 0) > 0;
    } catch {
      return false;
    }
  };

  return {
    cart: null,
    deviceId: '',
    isLoading: false,
    fromCache: false,

    initDeviceId: ensureDeviceId,

    loadCart: async () => {
      const deviceId = await ensureDeviceId();
      set({ isLoading: true });

      if (await isNetworkConnected()) {
        try {
          const cart = await api.cartAction({ action: 'list', device_id: deviceId });
          await applyServerCart(cart);
          set({ isLoading: false });
          return;
        } catch {
          // fall through to cache
        }
      }

      const cached = await loadCartCache();
      set({
        cart: cached ?? emptyCart(deviceId),
        isLoading: false,
        fromCache: true,
      });
    },

    syncWithServer,

    /** Matches backend: cart row must exist (via POST /cart) with items before POST /orders. */
    placeOrder: async () => {
      const deviceId = await ensureDeviceId();
      const local = get().cart ?? (await loadCartCache());
      const items = local?.items ?? [];

      if (items.length === 0) {
        throw new Error('cart is empty');
      }
      if (!(await isNetworkConnected())) {
        throw new Error('no network connection');
      }

      // Backend orders.Create only SELECTs cart — POST /cart list runs findOrCreateCart
      await api.cartAction({ action: 'list', device_id: deviceId });

      let serverCart = await api.cartAction({ action: 'list', device_id: deviceId });
      const serverHasItems = (serverCart.items?.length ?? 0) > 0;

      if (get().fromCache || !serverHasItems) {
        const synced = await syncWithServer();
        if (!synced) {
          throw new Error('failed to sync cart with server');
        }
        serverCart = await api.cartAction({ action: 'list', device_id: deviceId });
      }

      if (!(serverCart.items?.length ?? 0)) {
        throw new Error('cart is empty on server');
      }

      const order = await api.createOrder(deviceId);
      await applyServerCart(serverCart);
      return order;
    },

    addItem: async (productId, quantity, note, scheduledDelivery) => {
      const deviceId = await ensureDeviceId();
      const base = get().cart ?? (await loadCartCache()) ?? emptyCart(deviceId);

      if (await isNetworkConnected()) {
        try {
          const cart = await api.cartAction({
            action: 'add',
            product_id: productId,
            quantity,
            note,
            scheduled_delivery: scheduledDelivery,
            device_id: deviceId,
          });
          await applyServerCart(cart);
          return;
        } catch {
          // fall through to local cart
        }
      }

      const product = await findProduct(productId);
      const next = applyLocalAdd(base, productId, quantity, note, scheduledDelivery, product);
      await persistLocalCart(next);
    },

    removeItem: async (productId) => {
      const deviceId = await ensureDeviceId();
      const base = get().cart ?? (await loadCartCache()) ?? emptyCart(deviceId);

      if (await isNetworkConnected()) {
        try {
          const cart = await api.cartAction({
            action: 'remove',
            product_id: productId,
            device_id: deviceId,
          });
          await applyServerCart(cart);
          return;
        } catch {
          // fall through to local cart
        }
      }

      await persistLocalCart(applyLocalRemove(base, productId));
    },

    updateItem: async (productId, quantity, note) => {
      const deviceId = await ensureDeviceId();
      const base = get().cart ?? (await loadCartCache()) ?? emptyCart(deviceId);

      if (await isNetworkConnected()) {
        try {
          const cart = await api.cartAction({
            action: 'update',
            product_id: productId,
            quantity,
            note,
            device_id: deviceId,
          });
          await applyServerCart(cart);
          return;
        } catch {
          // fall through to local cart
        }
      }

      await persistLocalCart(applyLocalUpdate(base, productId, quantity, note));
    },
  };
});
