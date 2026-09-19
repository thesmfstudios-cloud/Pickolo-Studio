import { useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../shared/supabase';

type Booking = {
  booking_code: string;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  location_text: string;
  notes?: string | null;
  customer_price_paise: number;
  service?: { name?: string | null } | null;
  service_level?: { name?: string | null } | null;
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  async function confirmDelivery() {
    if (!supabase || !id) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace('/auth');
      return;
    }

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/bookings/' + id + '/confirm-delivery', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      Alert.alert('Unable to confirm', result.error || 'Please try again.');
      return;
    }

    Alert.alert('Delivery confirmed', 'Your booking is now ready for Pickolo payout processing.', [
      { text: 'Done', onPress: () => router.replace({ pathname: '/booking-detail', params: { id } }) },
    ]);
  }

  async function cancelBooking() {
    if (!supabase || !id) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace('/auth');
      return;
    }

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/bookings/' + id + '/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ reason: 'Customer requested cancellation.' }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      Alert.alert('Unable to cancel', result.error || 'Please try again.');
      return;
    }

    Alert.alert('Booking cancelled', 'Your booking has been cancelled.', [
      { text: 'Done', onPress: () => router.replace({ pathname: '/booking-detail', params: { id } }) },
    ]);
  }

  useEffect(() => {
    async function load() {
      if (!supabase || !id) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        router.replace('/auth');
        return;
      }

      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
      const response = await fetch(baseUrl + '/api/bookings/' + id, {
        headers: { Authorization: 'Bearer ' + token },
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        Alert.alert('Booking unavailable', result.error || 'Unable to load booking.');
        router.back();
        return;
      }

      setBooking(result.booking);
    }

    load();
  }, [id]);

  if (!booking) {
    return <SafeAreaView style={styles.safe}><View style={styles.container}><Text style={styles.muted}>Loading booking...</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>{booking.booking_code}</Text>
        <Text style={styles.badge}>{booking.status}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Service</Text>
          <Text style={styles.value}>{booking.service?.name || 'Photography'}</Text>

          <Text style={styles.label}>Service level</Text>
          <Text style={styles.value}>{booking.service_level?.name || 'Standard'}</Text>

          <Text style={styles.label}>When</Text>
          <Text style={styles.value}>{new Date(booking.scheduled_start).toLocaleString()}</Text>

          <Text style={styles.label}>Duration</Text>
          <Text style={styles.value}>{booking.duration_minutes} minutes</Text>

          <Text style={styles.label}>Location</Text>
          <Text style={styles.value}>{booking.location_text}</Text>

          <Text style={styles.label}>Booking total</Text>
          <Text style={styles.price}>₹{(booking.customer_price_paise / 100).toFixed(0)}</Text>

          {booking.notes ? <><Text style={styles.label}>Requirement</Text><Text style={styles.value}>{booking.notes}</Text></> : null}

          {booking.status === 'REQUESTED' && (
            <Pressable style={styles.primary} onPress={() => router.replace({ pathname: '/payment', params: { id } })}>
              <Text style={styles.primaryText}>Pay booking</Text>
            </Pressable>
          )}

          {booking.status === 'DATA_SUBMITTED' && (
            <Pressable style={styles.primary} onPress={confirmDelivery}>
              <Text style={styles.primaryText}>Confirm delivery</Text>
            </Pressable>
          )}

          {booking.status === 'COMPLETED' && (
            <View style={styles.reviewCard}>
              <Text style={styles.reviewTitle}>Rate your photographer</Text>
              <View style={styles.ratingRow}>
                {[1,2,3,4,5].map((value) => (
                  <Pressable key={value} onPress={() => setRating(value)} style={[styles.rating, rating === value && styles.ratingActive]}>
                    <Text style={styles.ratingText}>{value}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.reviewHint}>1 to 5</Text>
              <Pressable
                style={styles.primary}
                onPress={async () => {
                  if (!supabase || !id) return;
                  const { data } = await supabase.auth.getSession();
                  const token = data.session?.access_token;
                  if (!token) return;
                  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
                  const response = await fetch(baseUrl + '/api/bookings/' + id + '/review', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                    body: JSON.stringify({ rating, comment }),
                  });
                  const result = await response.json().catch(() => ({}));
                  if (!response.ok) {
                    Alert.alert('Unable to submit review', result.error || 'Please try again.');
                    return;
                  }
                  Alert.alert('Review saved', 'Thank you for rating the booking.');
                }}
              >
                <Text style={styles.primaryText}>Submit review</Text>
              </Pressable>
            </View>
          )}

          {['REQUESTED', 'PAYMENT_CONFIRMED', 'SEARCHING_PARTNER', 'PARTNER_ASSIGNED'].includes(booking.status) && (
            <Pressable style={styles.danger} onPress={cancelBooking}>
              <Text style={styles.dangerText}>Cancel booking</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: '#1e3a8a', fontWeight: '800', fontSize: 16 },
  title: { marginTop: 18, fontSize: 31, fontWeight: '800', color: '#13213a' },
  badge: { alignSelf: 'flex-start', marginTop: 11, color: '#1d4ed8', backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, fontSize: 11, fontWeight: '800' },
  card: { marginTop: 18, padding: 20, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  label: { marginTop: 16, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: '#64748b' },
  value: { marginTop: 5, fontSize: 16, lineHeight: 23, color: '#13213a', fontWeight: '600' },
  price: { marginTop: 5, fontSize: 25, color: '#13213a', fontWeight: '800' },
  primary: { marginTop: 18, backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  danger: { marginTop: 10, backgroundColor: '#fff1f2', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  dangerText: { color: '#be123c', fontWeight: '800' },
  reviewCard: { marginTop: 14, padding: 16, borderRadius: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  reviewTitle: { fontSize: 17, fontWeight: '800', color: '#13213a' },
  ratingRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  rating: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  ratingActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  ratingText: { color: '#13213a', fontWeight: '800' },
  reviewHint: { marginTop: 6, color: '#94a3b8', fontSize: 12 },
  muted: { color: '#64748b' },
});
