import { api } from '@/services/api';
import { loadProductsCache, upsertProductsCache } from '@/services/cache';
import { isNetworkConnected } from '@/services/network';
import type { Product } from '@/types';

function filterProducts(products: Product[], query: string): Product[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return products;

  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(normalized) ||
      p.description.toLowerCase().includes(normalized)
  );
}

async function isOnline(): Promise<boolean> {
  return isNetworkConnected();
}

async function searchLocalProducts(
  query: string,
  loadedProducts: Product[]
): Promise<Product[]> {
  const cached = await loadProductsCache();
  const byId = new Map<number, Product>();
  for (const product of cached ?? []) {
    byId.set(product.id, product);
  }
  for (const product of loadedProducts) {
    byId.set(product.id, product);
  }
  return filterProducts(Array.from(byId.values()), query);
}

/**
 * Search orchestration — cache layer stays generic; wire API here only.
 *
 * 1. Online + backend supports `?search=` → API results, upserted into cache automatically.
 * 2. Offline / cached mode → search merged local cache + in-memory products immediately.
 * 3. Online fallback → local search when API has no search support or fails.
 */
export async function searchProducts(
  query: string,
  loadedProducts: Product[],
  fromCache = false
): Promise<Product[]> {
  const trimmed = query.trim();
  if (!trimmed) return loadedProducts;

  if (!fromCache && (await isOnline())) {
    try {
      const apiResults = await api.searchProducts(trimmed);
      if (apiResults) {
        await upsertProductsCache(apiResults);
        return apiResults;
      }
    } catch {
      // network/API error — fall through to local search
    }
  }

  return searchLocalProducts(trimmed, loadedProducts);
}
