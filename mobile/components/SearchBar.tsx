import React, { useEffect, useRef, useState } from 'react';
import { TextInput, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useProductSearch } from '@/hooks/useProducts';
import type { Product } from '@/types';

const DEBOUNCE_MS = 300;

interface Props {
  onResults: (products: Product[] | null, isSearchActive: boolean) => void;
}

export function SearchBar({ onResults }: Props) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const { search, products, fromCache } = useProductSearch();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;

  const runSearch = async (text: string, requestId: number) => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (!mountedRef.current) return;
      onResultsRef.current(null, false);
      setSearching(false);
      return;
    }

    setSearching(true);
    const results = await search(trimmed);
    if (!mountedRef.current || requestId !== requestIdRef.current) return;
    onResultsRef.current(results.slice(0, 20), true);
    setSearching(false);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Re-run search when cached/loaded products arrive while a query is active.
  useEffect(() => {
    if (!query.trim()) return;
    const requestId = ++requestIdRef.current;
    void runSearch(query, requestId);
  }, [products, fromCache, search]);

  const handleChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text.trim()) {
      onResultsRef.current(null, false);
      setSearching(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(() => {
      void runSearch(text, requestId);
    }, DEBOUNCE_MS);
  };

  return (
    <View style={[styles.container, focused && styles.containerFocused]}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search products..."
        placeholderTextColor="#9e9e9e"
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {searching && <ActivityIndicator size="small" color="#1976d2" style={styles.spinner} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 14,
    marginBottom: 12,
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  containerFocused: {
    borderColor: '#90caf9',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: '#212121',
    paddingVertical: 0,
  },
  spinner: {
    marginLeft: 8,
  },
});
