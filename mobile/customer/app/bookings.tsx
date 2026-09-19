import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';

type Booking = {
  id: string;
  booking_code: string;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  location_text: string;
  created_at: string;
  customer_price_paise?: number;
};

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      router.replace('/auth');
      return;
    }

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/bookings', {
      headers: { Authorization: 'Bearer ' + token },
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      Alert.alert('Unable to load bookings', result.error || 'Please try again.');
      return;
    }

    setBookings(result.bookings || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Your bookings</Text>
        <Text style={styles.subtitle}>Track every Pickolo assignment from request to completion.</Text>

        {bookings.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.muted}>Your confirmed requests will appear here.</Text>
            <Pressable style={styles.primary} onPress={() => router.push('/booking')}>
              <Text style={styles.primaryText}>Book photography</Text>
            </Pressable>
          </View>
        ) : bookings.map((booking) => (
          <Pressable
            key={booking.id}
            style={styles.card}
            onPress={() => router.push({ pathname: '/booking-detail', params: { id: booking.id } })}
          >
            <View style={styles.row}>
              <Text style={styles.code}>{booking.booking_code}</Text>
              <Text style={styles.badge}>{booking.status}</Text>
            </View>
            <Text style={styles.date}>{new Date(booking.scheduled_start).toLocaleString()}</Text>
            <Text style={styles.muted}>{booking.duration_minutes} min · {booking.location_text}</Text>
            {typeof booking.customer_price_paise === 'number' && (
              <Text style={styles.price}>₹{(booking.customer_price_paise / 100).toFixed(0)}</Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: '#1e3a8a', fontWeight: '800', fontSize: 16 },
  title: { marginTop: 18, fontSize: 32, fontWeight: '800', color: '#13213a' },
  subtitle: { marginTop: 6, color: '#64748b', fontSize: 16, lineHeight: 23 },
  empty: { marginTop: 24, padding: 22, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#13213a' },
  card: { marginTop: 14, padding: 18, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  code: { fontSize: 16, fontWeight: '800', color: '#13213a' },
  badge: { maxWidth: 190, color: '#1d4ed8', backgroundColor: '#eff6ff', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, fontSize: 10, fontWeight: '800' },
  date: { marginTop: 12, color: '#334155', fontWeight: '700' },
  muted: { marginTop: 7, color: '#64748b', lineHeight: 21 },
  price: { marginTop: 12, fontSize: 18, fontWeight: '800', color: '#13213a' },
  primary: { marginTop: 18, backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
});
