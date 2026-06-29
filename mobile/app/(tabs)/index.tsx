import React, { useCallback, useState } from 'react';
import { FlatList, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ProductCard } from '@/components/ProductCard';
import { SearchBar } from '@/components/SearchBar';
import { useProducts } from '@/hooks/useProducts';
import { useCartStore } from '@/store/cartStore';
import { useProductStore } from '@/store/productStore';
import type { Product } from '@/types';

export default function ProductsScreen() {
  const router = useRouter();
  const { products, isLoading, loadNextPage } = useProducts();
  const addItem = useCartStore((s) => s.addItem);
  const fromCache = useProductStore((s) => s.fromCache);
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [isSearchActive, setIsSearchActive] = useState(false);

  const displayProducts = isSearchActive ? (searchResults ?? []) : products;

  const handleEndReached = useCallback(() => {
    if (!isSearchActive) loadNextPage();
  }, [isSearchActive, loadNextPage]);

  const handleAddToCart = useCallback(
    (product: Product) => {
      addItem(product.id, 1);
    },
    [addItem]
  );

  return (
    <View style={styles.container}>
      {fromCache && (
        <Text style={styles.offlineBanner}>Offline — showing cached products</Text>
      )}
      <SearchBar
        onResults={(results, active) => {
          setSearchResults(results);
          setIsSearchActive(active);
        }}
      />
      {isLoading && products.length === 0 ? (
        <ActivityIndicator size="large" color="#1976d2" style={styles.loader} />
      ) : isSearchActive && displayProducts.length === 0 ? (
        <View style={styles.emptyScreen}>
          <Text style={styles.emptySearch}>No products found</Text>
        </View>
      ) : (
        <FlatList
          style={styles.listView}
          data={displayProducts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={(p) => router.push(`/product/${p.id}`)}
              onAddToCart={handleAddToCart}
            />
          )}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          ListFooterComponent={isLoading ? <ActivityIndicator color="#1976d2" /> : null}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 12 },
  offlineBanner: {
    backgroundColor: '#fff3e0',
    color: '#e65100',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 13,
  },
  listView: { flex: 1 },
  list: { paddingBottom: 20 },
  loader: { flex: 1 },
  emptyScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptySearch: {
    textAlign: 'center',
    color: '#757575',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
});
