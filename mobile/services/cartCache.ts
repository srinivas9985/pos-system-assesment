import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Cart } from '@/types';

const CART_CACHE_KEY = 'surat_cache_cart';

export async function saveCartCache(cart: Cart): Promise<void> {
  await AsyncStorage.setItem(CART_CACHE_KEY, JSON.stringify(cart));
}

export async function loadCartCache(): Promise<Cart | null> {
  const raw = await AsyncStorage.getItem(CART_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Cart;
  } catch {
    return null;
  }
}

export async function clearCartCache(): Promise<void> {
  await AsyncStorage.removeItem(CART_CACHE_KEY);
}
