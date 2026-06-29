import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsOffline } from '@/hooks/useIsOffline';
import { useCartStore } from '@/store/cartStore';
import { useOrderStore } from '@/store/orderStore';
import type { Order } from '@/types';

export default function OrdersScreen() {
  const router = useRouter();
  const deviceId = useCartStore((s) => s.deviceId);
  const isOffline = useIsOffline();
  const { orders, isLoading, fromCache, loadOrders, payOrder } = useOrderStore();
  const [refreshing, setRefreshing] = useState(false);
  const showPay = !isOffline && !fromCache;

  useEffect(() => {
    if (deviceId) loadOrders();
  }, [deviceId, loadOrders]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  const statusColor = (status: Order['status']) =>
    ({ draft: '#ff9800', success: '#4caf50', failed: '#f44336' }[status]);

  if (isLoading && orders.length === 0) {
    return <ActivityIndicator size="large" color="#1976d2" style={styles.loader} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Orders</Text>
      {(isOffline || fromCache) && (
        <Text style={styles.offlineBanner}>
          Offline — showing cached orders. Payment needs a connection.
        </Text>
      )}
      <FlatList
        data={orders}
        keyExtractor={(o) => String(o.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.order}
            onPress={() => router.push(`/order/${item.id}`)}
          >
            <View>
              <Text style={styles.orderId}>Order #{item.id}</Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
            <View style={styles.right}>
              <Text style={[styles.status, { color: statusColor(item.status) }]}>
                {item.status.toUpperCase()}
              </Text>
              {item.status === 'draft' && showPay && (
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={(event) => {
                    event.stopPropagation();
                    void payOrder(item.id);
                  }}
                >
                  <Text style={styles.payBtnText}>Pay</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No orders yet</Text>}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 12 },
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  offlineBanner: {
    backgroundColor: '#fff3e0',
    color: '#e65100',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 13,
  },
  loader: { flex: 1 },
  order: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  orderId: { fontSize: 16, fontWeight: '600' },
  date: { fontSize: 12, color: '#9e9e9e', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  status: { fontWeight: '700', fontSize: 14 },
  payBtn: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  payBtnText: { color: '#fff', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9e9e9e', marginTop: 40, fontSize: 16 },
});
