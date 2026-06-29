import { create } from 'zustand';
import { api } from '@/services/api';
import {
  loadAllCache,
  persistProductState,
  saveCategoriesCache,
  saveProductsCache,
  saveTagsCache,
  upsertProductsCache,
} from '@/services/cache';
import {
  applyEventsToState,
  computeSyncSince,
  flattenSyncEvents,
} from '@/services/syncHelpers';
import { useSyncStore } from '@/store/syncStore';
import { isVersionConflictError, type Category, type Product, type SyncEvent, type SyncResponse, type Tag } from '@/types';

interface ProductState {
  products: Product[];
  categories: Category[];
  tags: Tag[];
  isLoading: boolean;
  nextCursor: string | null;
  error: string | null;
  fromCache: boolean;
  loadProducts: () => Promise<void>;
  loadNextPage: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadTags: () => Promise<void>;
  hydrateFromCache: () => Promise<boolean>;
  refreshSilently: () => Promise<void>;
  bumpProduct: (id: number, expectedVersion: number) => Promise<'ok' | 'conflict' | void>;
  applySyncEvent: (event: SyncEvent) => void;
  applySync: (response: SyncResponse) => void;
  fetchSync: () => Promise<SyncResponse>;
  runSync: () => Promise<void>;
}

async function cacheCurrentState(
  products: Product[],
  categories: Category[],
  tags: Tag[]
): Promise<void> {
  try {
    await persistProductState(products, categories, tags);
  } catch {
    // cache write failures should not break the app
  }
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  categories: [],
  tags: [],
  isLoading: false,
  nextCursor: null,
  error: null,
  fromCache: false,

  hydrateFromCache: async () => {
    const cached = await loadAllCache();
    const hasData =
      (cached.products?.length ?? 0) > 0 ||
      (cached.categories?.length ?? 0) > 0 ||
      (cached.tags?.length ?? 0) > 0;
    if (!hasData) return false;

    set({
      products: cached.products ?? get().products,
      categories: cached.categories ?? get().categories,
      tags: cached.tags ?? get().tags,
      nextCursor: cached.nextCursor ?? get().nextCursor,
      fromCache: true,
      error: null,
    });
    return true;
  },

  loadProducts: async () => {
    set({ isLoading: true, error: null });
    await get().hydrateFromCache();
    try {
      const response = await api.getProducts();
      set({
        products: response.data,
        nextCursor: response.next_cursor,
        isLoading: false,
        fromCache: false,
      });
      await saveProductsCache(response.data, response.next_cursor);
    } catch {
      const restored = get().fromCache || (await get().hydrateFromCache());
      set({
        isLoading: false,
        error: restored ? null : 'Failed to load products',
      });
    }
  },

  loadNextPage: async () => {
    const { nextCursor, products, isLoading } = get();
    if (!nextCursor || isLoading) return;
    set({ isLoading: true });
    try {
      const response = await api.getProducts(nextCursor);
      const merged = [...products, ...response.data];
      set({
        products: merged,
        nextCursor: response.next_cursor,
        isLoading: false,
        fromCache: false,
      });
      await saveProductsCache(merged, response.next_cursor);
    } catch {
      set({ isLoading: false });
    }
  },

  loadCategories: async () => {
    try {
      const categories = await api.getCategories();
      set({ categories, fromCache: false });
      await saveCategoriesCache(categories);
    } catch {
      await get().hydrateFromCache();
    }
  },

  loadTags: async () => {
    try {
      const tags = await api.getTags();
      set({ tags, fromCache: false });
      await saveTagsCache(tags);
    } catch {
      await get().hydrateFromCache();
    }
  },

  refreshSilently: async () => {
    const { loadProducts, loadCategories, loadTags, runSync } = get();
    try {
      await Promise.all([loadProducts(), loadCategories(), loadTags()]);
      await runSync();
    } catch {
      // silent refresh — cached data remains visible
    }
  },

  bumpProduct: async (id, expectedVersion) => {
    try {
      const result = await api.bumpProduct(id, expectedVersion);
      set((state) => {
        const products = state.products.map((p) =>
          p.id === id ? { ...p, version: result.version } : p
        );
        const updated = products.find((p) => p.id === id);
        if (updated) void upsertProductsCache([updated]);
        return { products };
      });
      return 'ok';
    } catch (e) {
      if (isVersionConflictError(e)) {
        const serverVersion = e.currentVersion;
        set((state) => {
          const products = state.products.map((p) =>
            p.id === id ? { ...p, version: serverVersion } : p
          );
          const updated = products.find((p) => p.id === id);
          if (updated) void upsertProductsCache([updated]);
          return { products };
        });
        useSyncStore.getState().addConflict({
          entityType: 'product',
          entityId: id,
          localVersion: expectedVersion + 1,
          serverVersion,
          detectedAt: new Date().toISOString(),
        });
        return 'conflict';
      }
      console.error('Bump failed', e);
    }
  },

  applySyncEvent: (event) => {
    set((state) => {
      const next = applyEventsToState(state.products, state.categories, state.tags, [event]);
      void cacheCurrentState(next.products, next.categories, next.tags);
      return next;
    });
  },

  applySync: (response) => {
    const events = flattenSyncEvents(response);
    if (events.length === 0) return;
    set((state) => {
      const next = applyEventsToState(state.products, state.categories, state.tags, events);
      void cacheCurrentState(next.products, next.categories, next.tags);
      return next;
    });
  },

  fetchSync: async () => {
    const { products, categories, tags } = get();
    const since = computeSyncSince(products, categories, tags);
    return api.getSync(since);
  },

  runSync: async () => {
    try {
      const response = await get().fetchSync();
      get().applySync(response);
    } catch (e) {
      console.error('Sync failed', e);
    }
  },
}));
