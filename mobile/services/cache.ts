import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Category, Product, Tag } from '@/types';

const CACHE_KEYS = {
  products: 'surat_cache_products',
  categories: 'surat_cache_categories',
  tags: 'surat_cache_tags',
  nextCursor: 'surat_cache_next_cursor',
} as const;

function filterProducts(products: Product[], query: string): Product[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(normalized) ||
      p.description.toLowerCase().includes(normalized)
  );
}

export async function upsertProductsCache(products: Product[]): Promise<void> {
  if (products.length === 0) return;
  const existing = (await loadProductsCache()) ?? [];
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const product of products) {
    byId.set(product.id, product);
  }
  await AsyncStorage.setItem(
    CACHE_KEYS.products,
    JSON.stringify(Array.from(byId.values()).sort((a, b) => a.id - b.id))
  );
}

export async function searchProductsCache(query: string): Promise<Product[]> {
  const cached = await loadProductsCache();
  if (!cached?.length) return [];
  return filterProducts(cached, query);
}

export async function saveProductsCache(
  products: Product[],
  nextCursor?: string | null
): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEYS.products, JSON.stringify(products));
  if (nextCursor !== undefined) {
    await AsyncStorage.setItem(CACHE_KEYS.nextCursor, nextCursor ?? '');
  }
}

export async function saveCategoriesCache(categories: Category[]): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEYS.categories, JSON.stringify(categories));
}

export async function saveTagsCache(tags: Tag[]): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEYS.tags, JSON.stringify(tags));
}

export async function loadProductsCache(): Promise<Product[] | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEYS.products);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Product[];
  } catch {
    return null;
  }
}

export async function loadNextCursorCache(): Promise<string | null> {
  const value = await AsyncStorage.getItem(CACHE_KEYS.nextCursor);
  return value ? value : null;
}

export async function loadCategoriesCache(): Promise<Category[] | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEYS.categories);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Category[];
  } catch {
    return null;
  }
}

export async function loadTagsCache(): Promise<Tag[] | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEYS.tags);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tag[];
  } catch {
    return null;
  }
}

export async function persistProductState(
  products: Product[],
  categories: Category[],
  tags: Tag[]
): Promise<void> {
  await Promise.all([
    upsertProductsCache(products),
    saveCategoriesCache(categories),
    saveTagsCache(tags),
  ]);
}

export async function loadAllCache(): Promise<{
  products: Product[] | null;
  categories: Category[] | null;
  tags: Tag[] | null;
  nextCursor: string | null;
}> {
  const [products, categories, tags, nextCursor] = await Promise.all([
    loadProductsCache(),
    loadCategoriesCache(),
    loadTagsCache(),
    loadNextCursorCache(),
  ]);
  return { products, categories, tags, nextCursor };
}

export async function getStoredValue(key: string): Promise<string | null> {
  return AsyncStorage.getItem(key);
}

export async function setStoredValue(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
}
