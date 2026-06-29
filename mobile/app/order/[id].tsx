import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useIsOffline } from '@/hooks/useIsOffline';
import { useCartStore } from '@/store/cartStore';
import { useOrderStore } from '@/store/orderStore';
import type { Order } from '@/types';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const deviceId = useCartStore((s) => s.deviceId);
  const isOffline = useIsOffline();
  const orders = useOrderStore((s) => s.orders);
  const fromCache = useOrderStore((s) => s.fromCache);
  const loadOrders = useOrderStore((s) => s.loadOrders);
  const payOrder = useOrderStore((s) => s.payOrder);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const showPay = !isOffline && !fromCache;

  const order = orders.find((o) => o.id === orderId) ?? null;

  useEffect(() => {
    const load = async () => {
      if (deviceId) {
        await loadOrders();
      }
      setLoading(false);
    };
    void load();
  }, [deviceId, loadOrders]);

  const handlePay = async () => {
    if (!order) return;
    setPaying(true);
    await payOrder(order.id);
    setPaying(false);
  };

  const statusColor = (status: Order['status']) =>
    ({ draft: '#ff9800', success: '#4caf50', failed: '#f44336' }[status]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!order) return <Text style={styles.error}>Order not found</Text>;

  return (
    <View style={styles.container}>
      {(isOffline || fromCache) && (
        <Text style={styles.offlineBanner}>Offline — payment requires a connection.</Text>
      )}
      <Text style={styles.title}>Order #{order.id}</Text>
      <Text style={[styles.status, { color: statusColor(order.status) }]}>
        Status: {order.status.toUpperCase()}
      </Text>
      <Text style={styles.date}>Created: {new Date(order.created_at).toLocaleString()}</Text>
      {order.status === 'draft' && showPay && (
        <TouchableOpacity style={styles.payBtn} onPress={handlePay} disabled={paying}>
          <Text style={styles.payBtnText}>{paying ? 'Processing...' : 'Pay Now'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  offlineBanner: {
    backgroundColor: '#fff3e0',
    color: '#e65100',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 13,
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  status: { fontSize: 18, marginBottom: 8, fontWeight: '600' },
  date: { fontSize: 14, color: '#9e9e9e', marginBottom: 24 },
  payBtn: { backgroundColor: '#1976d2', padding: 16, borderRadius: 8, alignItems: 'center' },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { textAlign: 'center', marginTop: 40, fontSize: 16 },
});
