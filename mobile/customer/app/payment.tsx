import { useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import RazorpayCheckout from 'react-native-razorpay';
import { supabase } from '../../shared/supabase';

type PaymentOrder = {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
};

export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, [id]);

  async function loadOrder() {
    if (!supabase || !id) {
      setLoading(false);
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setLoading(false);
      router.replace('/auth');
      return;
    }

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/payments/order/' + id, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    });

    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      Alert.alert('Payment unavailable', result.error || 'Unable to prepare payment.');
      router.replace('/home');
      return;
    }

    setOrder(result);
  }

  async function pay() {
    if (!supabase || !order || !id) return;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const { data: userData } = await supabase.auth.getUser();

    if (!token) {
      router.replace('/auth');
      return;
    }

    setBusy(true);

    try {
      const result = await RazorpayCheckout.open({
        key: order.keyId,
        amount: String(order.amountPaise),
        currency: order.currency,
        name: 'Pickolo',
        description: 'Photography booking',
        order_id: order.orderId,
        prefill: {
          email: userData.user?.email || '',
          contact: userData.user?.phone || '',
          name: userData.user?.user_metadata?.full_name || '',
        },
        theme: { color: '#2563eb' },
      });

      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
      const verificationResponse = await fetch(baseUrl + '/api/payments/verify/' + id, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(result),
      });

      const verification = await verificationResponse.json().catch(() => ({}));

      if (!verificationResponse.ok) {
        Alert.alert('Payment verification failed', verification.error || 'Payment could not be verified.');
        return;
      }

      Alert.alert('Payment successful', 'Your Pickolo booking is confirmed.', [
        { text: 'View booking', onPress: () => router.replace({ pathname: '/booking-detail', params: { id } }) },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment was cancelled or failed.';
      Alert.alert('Payment', message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Secure payment</Text>
        <Text style={styles.subtitle}>Your booking amount is calculated and verified by Pickolo's server.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Amount</Text>
          <Text style={styles.price}>
            {loading || !order ? '...' : '₹' + (order.amountPaise / 100).toFixed(0)}
          </Text>
          <Text style={styles.muted}>Payment is processed by Razorpay.</Text>
        </View>

        <Pressable style={styles.primary} onPress={pay} disabled={!order || busy || loading}>
          <Text style={styles.primaryText}>
            {busy ? 'Processing...' : 'Pay securely'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  back: { color: '#1e3a8a', fontWeight: '800', fontSize: 16, alignSelf: 'flex-start' },
  title: { marginTop: 18, fontSize: 33, fontWeight: '800', color: '#13213a' },
  subtitle: { marginTop: 7, color: '#64748b', fontSize: 15, lineHeight: 22 },
  card: { marginTop: 22, padding: 22, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  label: { color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12, fontWeight: '800' },
  price: { marginTop: 6, fontSize: 36, fontWeight: '900', color: '#13213a' },
  muted: { marginTop: 8, color: '#64748b', lineHeight: 20 },
  primary: { marginTop: 16, backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
