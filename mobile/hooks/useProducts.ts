import { useCallback, useEffect } from 'react';
import { searchProducts } from '@/services/productSearch';
import { useProductStore } from '@/store/productStore';
import type { Product } from '@/types';

export function useProducts() {
  const {
    products,
    isLoading,
    nextCursor,
    loadProducts,
    loadNextPage,
    loadCategories,
  } = useProductStore();

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  return { products, isLoading, nextCursor, loadNextPage };
}

export function useProductSearch() {
  const products = useProductStore((s) => s.products);
  const fromCache = useProductStore((s) => s.fromCache);

  const search = useCallback(
    async (query: string): Promise<Product[]> => {
      return searchProducts(query, products, fromCache);
    },
    [products, fromCache]
  );

  return { search, products, fromCache };
}
