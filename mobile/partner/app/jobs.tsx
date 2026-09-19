import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../shared/supabase';

type Job = {
  id: string;
  booking_code: string;
  status: string;
  partner_acceptance_status?: 'not_required' | 'pending' | 'accepted' | 'declined' | 'expired';
  partner_offer_expires_at?: string | null;
  location_lat?: number | null;
  location_long?: number | null;
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
  SHOOT_COMPLETED: { label: 'Prepare delivery', to: 'DATA_PENDING' },
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
              {job.partner_acceptance_status === 'pending' && job.partner_offer_expires_at && (
                <Text style={styles.offerExpiry}>Offer expires {new Date(job.partner_offer_expires_at).toLocaleTimeString()}</Text>
              )}

              {(job.location_lat !== null && job.location_lat !== undefined && job.location_long !== null && job.location_long !== undefined) && (
                <Pressable
                  style={styles.navigation}
                  onPress={() => {
                    const query = encodeURIComponent(String(job.location_lat) + ',' + String(job.location_long));
                    Linking.openURL('https://www.google.com/maps/search/?api=1&query=' + query).catch(() => {
                      Alert.alert('Maps unavailable', 'Unable to open navigation.');
                    });
                  }}
                >
                  <Text style={styles.navigationText}>Navigate</Text>
                </Pressable>
              )}

              {job.status === 'PARTNER_ASSIGNED' && job.partner_acceptance_status === 'pending' && (
                <View style={styles.offerRow}>
                  <Pressable
                    style={styles.primarySmall}
                    onPress={async () => {
                      if (!supabase) return;
                      const { data } = await supabase.auth.getSession();
                      const token = data.session?.access_token;
                      if (!token) return;

                      setBusyId(job.id);
                      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
                      const response = await fetch(baseUrl + '/api/partner/jobs/' + job.id + '/respond', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                        body: JSON.stringify({ action: 'accept' }),
                      });
                      const result = await response.json().catch(() => ({}));
                      setBusyId(null);
                      if (!response.ok) {
                        Alert.alert('Unable to accept', result.error || 'Please try again.');
                        return;
                      }
                      await load();
                    }}
                    disabled={busyId === job.id}
                  >
                    <Text style={styles.primaryText}>{busyId === job.id ? 'Working...' : 'Accept job'}</Text>
                  </Pressable>

                  <Pressable
                    style={styles.secondarySmall}
                    onPress={async () => {
                      if (!supabase) return;
                      const { data } = await supabase.auth.getSession();
                      const token = data.session?.access_token;
                      if (!token) return;

                      setBusyId(job.id);
                      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
                      const response = await fetch(baseUrl + '/api/partner/jobs/' + job.id + '/respond', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                        body: JSON.stringify({ action: 'decline', reason: 'Partner declined the assignment.' }),
                      });
                      const result = await response.json().catch(() => ({}));
                      setBusyId(null);
                      if (!response.ok) {
                        Alert.alert('Unable to decline', result.error || 'Please try again.');
                        return;
                      }
                      await load();
                    }}
                    disabled={busyId === job.id}
                  >
                    <Text style={styles.secondaryText}>Decline</Text>
                  </Pressable>
                </View>
              )}

              {action && !(job.status === 'PARTNER_ASSIGNED' && job.partner_acceptance_status === 'pending') && (
                <Pressable
                  style={styles.primary}
                  onPress={() => transition(job)}
                  disabled={busyId === job.id}
                >
                  <Text style={styles.primaryText}>{busyId === job.id ? 'Updating...' : action.label}</Text>
                </Pressable>
              )}

              {job.status === 'DATA_PENDING' && (
                <Pressable
                  style={styles.secondary}
                  onPress={() => router.push({ pathname: '/delivery', params: { id: job.id } })}
                >
                  <Text style={styles.secondaryText}>Submit delivery</Text>
                </Pressable>
              )}

              {['PARTNER_ASSIGNED', 'ON_THE_WAY'].includes(job.status) && (
                <Pressable
                  style={styles.danger}
                  onPress={async () => {
                    if (!supabase) return;
                    const { data } = await supabase.auth.getSession();
                    const token = data.session?.access_token;
                    if (!token) return;

                    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
                    const response = await fetch(baseUrl + '/api/partner/jobs/' + job.id + '/cancel', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + token,
                      },
                      body: JSON.stringify({ reason: 'Partner cancelled the assignment.' }),
                    });
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok) {
                      Alert.alert('Unable to cancel', result.error || 'Please try again.');
                      return;
                    }
                    Alert.alert('Assignment cancelled', 'The booking has been returned to Pickolo for reassignment.');
                    await load();
                  }}
                >
                  <Text style={styles.dangerText}>Cancel assignment</Text>
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
  secondary: { marginTop: 10, backgroundColor: '#eef2ff', borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  offerRow: { marginTop: 16, flexDirection: 'row', gap: 9 },
  primarySmall: { flex: 1, backgroundColor: '#2563eb', borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  secondarySmall: { flex: 1, backgroundColor: '#eef2ff', borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  secondaryText: { color: '#1e3a8a', fontWeight: '800' },
  danger: { marginTop: 10, backgroundColor: '#fff1f2', borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  dangerText: { color: '#be123c', fontWeight: '800' },
  offerExpiry: { marginTop: 8, color: '#b45309', fontSize: 12, fontWeight: '800' },
  navigation: { marginTop: 10, backgroundColor: '#f1f5f9', borderRadius: 13, paddingVertical: 12, alignItems: 'center' },
  navigationText: { color: '#334155', fontWeight: '800' },
});
