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
  review_count: number;
  xp: number;
};
type Progression = {
  next_level?: { name?: string | null } | null;
  min_xp: number;
  min_average_rating: number;
  min_completed_jobs: number;
};
type XpEvent = { id: string; xp_delta: number; reason: string; created_at: string };
type Payout = { id: string; amount_paise: number; status: string; created_at: string };

export default function PerformanceScreen() {
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [level, setLevel] = useState<{ name?: string | null } | null>(null);
  const [progression, setProgression] = useState<Progression | null>(null);
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return router.replace('/auth');

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
    setLevel(result.level);
    setProgression(result.progression);
    setXpEvents(result.xp_events || []);
    setPayouts(result.payouts || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const xp = performance?.xp ?? 0;
  const minXp = progression?.min_xp ?? xp;
  const progress = progression ? Math.min(1, minXp > 0 ? xp / minXp : 1) : 1;
  const nextName = progression?.next_level?.name || null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Level & XP</Text>
        <Text style={styles.subtitle}>Do great work, earn strong reviews and unlock higher-value Pickolo jobs.</Text>

        <View style={styles.hero}>
          <Text style={styles.kicker}>CURRENT LEVEL</Text>
          <Text style={styles.level}>{level?.name || 'Pickolo Partner'}</Text>
          <View style={styles.xpRow}>
            <Text style={styles.xp}>{xp} XP</Text>
            {nextName ? <Text style={styles.next}>Next: {nextName}</Text> : <Text style={styles.next}>Top level unlocked</Text>}
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: (Math.round(progress * 100) + '%') as `${number}%` }]} /></View>
          {progression ? (
            <Text style={styles.muted}>
              Level-up target: {progression.min_xp} XP · {progression.min_completed_jobs} completed jobs · {progression.min_average_rating.toFixed(1)}★ rating
            </Text>
          ) : (
            <Text style={styles.muted}>You are eligible for the highest Pickolo pool.</Text>
          )}
        </View>

        <View style={styles.grid}>
          <Stat label="Completed" value={String(performance?.completed_jobs ?? 0)} />
          <Stat label="Rating" value={performance?.average_rating ? performance.average_rating.toFixed(1) + '★' : '—'} />
          <Stat label="Reviews" value={String(performance?.review_count ?? 0)} />
          <Stat label="On time" value={String(performance?.on_time_jobs ?? 0)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>How XP grows</Text>
          <Text style={styles.muted}>Completed Pickolo job: +100 XP</Text>
          <Text style={styles.muted}>5★ review: +100 XP · 4★: +70 · 3★: +40</Text>
          <Text style={styles.muted}>Useful written feedback can add up to +25 bonus XP.</Text>
          <Text style={styles.note}>Level-up also requires the minimum rating and completed-job count, so quality matters—not just volume.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent XP</Text>
          {xpEvents.length === 0 ? <Text style={styles.muted}>Your XP activity will appear here.</Text> :
            xpEvents.slice(0, 8).map((item) => (
              <View key={item.id} style={styles.event}>
                <View>
                  <Text style={styles.eventReason}>{item.reason}</Text>
                  <Text style={styles.eventDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.eventXp}>+{item.xp_delta} XP</Text>
              </View>
            ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reliability</Text>
          <Text style={styles.muted}>Delivered jobs: {performance?.delivered_jobs ?? 0}</Text>
          <Text style={styles.muted}>Cancellations: {performance?.cancellations ?? 0}</Text>
          <Text style={styles.muted}>No-shows: {performance?.no_shows ?? 0}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payouts</Text>
          {payouts.length === 0 ? (
            <Text style={styles.muted}>No payout records yet.</Text>
          ) : payouts.map((item) => (
            <View style={styles.event} key={item.id}>
              <View>
                <Text style={styles.eventReason}>₹{(item.amount_paise / 100).toFixed(0)}</Text>
                <Text style={styles.eventDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.payoutStatus}>{item.status}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f5f0' },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: '#34563d', fontWeight: '800', fontSize: 16 },
  title: { marginTop: 18, fontSize: 32, fontWeight: '900', color: '#202e29' },
  subtitle: { marginTop: 6, color: '#747d70', lineHeight: 22 },
  hero: { marginTop: 18, padding: 20, borderRadius: 22, backgroundColor: '#294f3b' },
  kicker: { color: '#d9e4dc', fontSize: 11, letterSpacing: 1.5, fontWeight: '900' },
  level: { marginTop: 7, color: '#fff', fontSize: 30, fontWeight: '900' },
  xpRow: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  xp: { color: '#fff', fontSize: 19, fontWeight: '900' },
  next: { color: '#d9e4dc', fontWeight: '800' },
  track: { marginTop: 10, height: 9, borderRadius: 999, backgroundColor: '#557161', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: '#f4f1df' },
  muted: { marginTop: 7, color: '#747d70', lineHeight: 21 },
  grid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '48%', padding: 16, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe3d7' },
  statValue: { fontSize: 25, fontWeight: '900', color: '#202e29' },
  statLabel: { marginTop: 4, color: '#747d70', fontWeight: '700' },
  card: { marginTop: 14, padding: 18, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe3d7' },
  cardTitle: { fontSize: 19, fontWeight: '900', color: '#202e29' },
  note: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#edf2e7', color: '#34563d', lineHeight: 20 },
  event: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#edf0e9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  eventReason: { color: '#202e29', fontWeight: '800' },
  eventDate: { marginTop: 3, color: '#9aa197', fontSize: 12 },
  eventXp: { color: '#294f3b', fontWeight: '900' },
  payoutStatus: { color: '#34563d', fontWeight: '800', textTransform: 'capitalize' },
});
