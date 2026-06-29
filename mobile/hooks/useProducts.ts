import { useEffect } from 'react';
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

  const search = async (query: string): Promise<Product[]> => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;

    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(normalized) ||
        p.description.toLowerCase().includes(normalized)
    );
  };

  return { search };
}
