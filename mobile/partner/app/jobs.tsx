import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';

type Job = {
  id: string;
  booking_code: string;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  location_text: string;
  service?: { name?: string | null } | null;
  service_level?: { name?: string | null } | null;
};

const NEXT_ACTION: Record<string, { label: string; to: string }> = {
  PARTNER_ASSIGNED: { label: 'Mark on the way', to: 'ON_THE_WAY' },
  ON_THE_WAY: { label: 'Start shoot', to: 'SHOOT_STARTED' },
  SHOOT_STARTED: { label: 'Complete shoot', to: 'SHOOT_COMPLETED' },
  DATA_PENDING: { label: 'Submit delivery', to: 'DATA_SUBMITTED' },
};

export default function PartnerJobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      router.replace('/auth');
      return;
    }

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/partner/jobs', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      Alert.alert('Unable to load jobs', result.error || 'Please try again.');
      return;
    }

    setJobs(result.jobs || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function transition(job: Job) {
    const action = NEXT_ACTION[job.status];
    if (!supabase || !action) return;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      router.replace('/auth');
      return;
    }

    setBusyId(job.id);
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const response = await fetch(baseUrl + '/api/bookings/' + job.id + '/transition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ to_status: action.to }),
    });

    const result = await response.json().catch(() => ({}));
    setBusyId(null);

    if (!response.ok) {
      Alert.alert('Action failed', result.error || 'Please refresh and try again.');
      return;
    }

    await load();
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Jobs</Text>
        <Text style={styles.subtitle}>Only assignments linked to your Partner account appear here.</Text>

        {jobs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No assigned jobs</Text>
            <Text style={styles.muted}>New eligible assignments will appear here.</Text>
          </View>
        ) : jobs.map((job) => {
          const action = NEXT_ACTION[job.status];
          return (
            <View key={job.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.code}>{job.booking_code}</Text>
                <Text style={styles.badge}>{job.status}</Text>
              </View>
              <Text style={styles.date}>{new Date(job.scheduled_start).toLocaleString()}</Text>
              <Text style={styles.muted}>{job.service?.name || 'Photography'} · {job.service_level?.name || 'Standard'}</Text>
              <Text style={styles.muted}>{job.duration_minutes} min · {job.location_text}</Text>

              {action && (
                <Pressable
                  style={styles.primary}
                  onPress={() => transition(job)}
                  disabled={busyId === job.id}
                >
                  <Text style={styles.primaryText}>{busyId === job.id ? 'Updating…' : action.label}</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: '#1e3a8a', fontWeight: '800', fontSize: 16 },
  title: { marginTop: 18, fontSize: 32, fontWeight: '800', color: '#13213a' },
  subtitle: { marginTop: 6, color: '#64748b', fontSize: 15, lineHeight: 22 },
  empty: { marginTop: 20, padding: 20, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#13213a' },
  card: { marginTop: 14, padding: 18, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  code: { fontSize: 16, fontWeight: '800', color: '#13213a' },
  badge: { color: '#1d4ed8', backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, fontSize: 10, fontWeight: '800' },
  date: { marginTop: 12, fontWeight: '700', color: '#334155' },
  muted: { marginTop: 6, color: '#64748b', lineHeight: 21 },
  primary: { marginTop: 16, backgroundColor: '#2563eb', borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
});
