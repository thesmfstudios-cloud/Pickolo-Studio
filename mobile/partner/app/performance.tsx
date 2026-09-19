import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';

type Performance = {
  completed_jobs: number;
  on_time_jobs: number;
  cancellations: number;
  no_shows: number;
  delivered_jobs: number;
  average_rating: number | null;
  xp: number;
};
type Payout = { id: string; amount_paise: number; status: string; created_at: string };

export default function PerformanceScreen() {
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace('/auth');
      return;
    }

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/partner/performance', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      Alert.alert('Unable to load performance', result.error || 'Please try again.');
      return;
    }
    setPerformance(result.performance);
    setPayouts(result.payouts || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Performance</Text>
        <Text style={styles.subtitle}>Your Pickolo reliability and payout history.</Text>

        <View style={styles.grid}>
          <Stat label="Completed" value={String(performance?.completed_jobs ?? 0)} />
          <Stat label="Delivered" value={String(performance?.delivered_jobs ?? 0)} />
          <Stat label="Rating" value={performance?.average_rating ? performance.average_rating.toFixed(1) : '—'} />
          <Stat label="XP" value={String(performance?.xp ?? 0)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reliability</Text>
          <Text style={styles.muted}>On-time: {performance?.on_time_jobs ?? 0}</Text>
          <Text style={styles.muted}>Cancellations: {performance?.cancellations ?? 0}</Text>
          <Text style={styles.muted}>No-shows: {performance?.no_shows ?? 0}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payouts</Text>
          {payouts.length === 0 ? (
            <Text style={styles.muted}>No payout records yet.</Text>
          ) : payouts.map((item) => (
            <View style={styles.payout} key={item.id}>
              <Text style={styles.payoutAmount}>₹{(item.amount_paise / 100).toFixed(0)}</Text>
              <Text style={styles.muted}>{item.status} · {new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: '#1e3a8a', fontWeight: '800', fontSize: 16 },
  title: { marginTop: 18, fontSize: 32, fontWeight: '800', color: '#13213a' },
  subtitle: { marginTop: 6, color: '#64748b', lineHeight: 22 },
  grid: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { width: '47%', padding: 17, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  statValue: { fontSize: 28, fontWeight: '900', color: '#13213a' },
  statLabel: { marginTop: 4, color: '#64748b', fontWeight: '700' },
  card: { marginTop: 14, padding: 18, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 19, fontWeight: '800', color: '#13213a' },
  muted: { marginTop: 6, color: '#64748b', lineHeight: 21 },
  payout: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  payoutAmount: { fontSize: 20, fontWeight: '800', color: '#13213a' },
});
